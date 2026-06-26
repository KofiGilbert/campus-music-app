import { Router, type IRouter } from "express";
import { and, count, desc, eq, gt, inArray, isNull, lt, ne } from "drizzle-orm";
import {
  conversations,
  conversationParticipants,
  db,
  messages,
  tracks,
  users,
} from "@workspace/db";
import { requireAuth, requireVerified } from "../middlewares/auth";
import { shapeMessage, shapeMessages, type ShapedMessage } from "../lib/messageShape";
import { conversationRoom, realtime } from "../realtime/gateway";
import { notifyMany } from "../lib/notify";

const router: IRouter = Router();

function parseLimit(value: unknown, fallback = 30, max = 50): number {
  const n = typeof value === "string" ? parseInt(value, 10) : NaN;
  if (isNaN(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function parseCursor(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

interface ParticipantLite {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  role: string;
}

interface ConversationSummary {
  id: string;
  type: string;
  participants: ParticipantLite[];
  lastMessage: ShapedMessage | null;
  unreadCount: number;
  lastMessageAt: Date;
}

/** Membership check — returns the participant row (with lastReadAt) or null. */
async function getParticipant(conversationId: string, userId: string) {
  const [row] = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Find an existing 1:1 DM between two users, or create one. */
async function findOrCreateDm(meId: string, otherId: string): Promise<string> {
  // Conversations the current user is in...
  const mine = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, meId));
  const myIds = mine.map((m) => m.conversationId);

  if (myIds.length) {
    // ...that the other user is also in, and that are 1:1 DMs.
    const shared = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, otherId),
          inArray(conversationParticipants.conversationId, myIds),
        ),
      );
    for (const s of shared) {
      const [conv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, s.conversationId), eq(conversations.type, "dm")))
        .limit(1);
      if (conv) return conv.id;
    }
  }

  const [created] = await db
    .insert(conversations)
    .values({ type: "dm", createdByUserId: meId })
    .returning();
  await db.insert(conversationParticipants).values([
    { conversationId: created.id, userId: meId },
    { conversationId: created.id, userId: otherId },
  ]);
  return created.id;
}

/** POST /conversations — open (or reuse) a 1:1 DM with another user. */
router.post("/conversations", requireAuth, requireVerified, async (req, res): Promise<void> => {
  const meId = req.userId!;
  const { userId } = req.body as { userId?: unknown };
  const otherId = typeof userId === "string" ? userId : null;
  if (!otherId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  if (otherId === meId) {
    res.status(400).json({ error: "Cannot message yourself" });
    return;
  }
  const [other] = await db.select({ id: users.id }).from(users).where(eq(users.id, otherId)).limit(1);
  if (!other) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const conversationId = await findOrCreateDm(meId, otherId);
  const summaries = await buildSummaries(meId, [conversationId]);
  res.status(201).json(summaries[0]);
});

/** GET /conversations — my conversations, newest activity first. */
router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const meId = req.userId!;
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const mine = await db
    .select({ conversationId: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, meId));
  const myIds = mine.map((m) => m.conversationId);
  if (myIds.length === 0) {
    res.json({ items: [], nextCursor: null });
    return;
  }

  const convRows = await db
    .select()
    .from(conversations)
    .where(
      cursor
        ? and(inArray(conversations.id, myIds), lt(conversations.lastMessageAt, cursor))
        : inArray(conversations.id, myIds),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit + 1);

  const hasMore = convRows.length > limit;
  const page = hasMore ? convRows.slice(0, limit) : convRows;
  const items = await buildSummaries(
    meId,
    page.map((c) => c.id),
  );
  res.json({
    items,
    nextCursor: hasMore ? page[page.length - 1].lastMessageAt.toISOString() : null,
  });
});

/** Build conversation summaries (participants, last message, unread count) for a
 * set of conversation ids, ordered to match the input. Batched (no N+1). */
async function buildSummaries(meId: string, convIds: string[]): Promise<ConversationSummary[]> {
  if (convIds.length === 0) return [];

  const convRows = await db.select().from(conversations).where(inArray(conversations.id, convIds));
  const convMap = new Map(convRows.map((c) => [c.id, c]));

  // All participants of these conversations (so we can show the other members).
  const partRows = await db
    .select()
    .from(conversationParticipants)
    .where(inArray(conversationParticipants.conversationId, convIds));
  const otherIds = [...new Set(partRows.map((p) => p.userId))];
  const userRows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(inArray(users.id, otherIds));
  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const myReadAt = new Map(
    partRows.filter((p) => p.userId === meId).map((p) => [p.conversationId, p.lastReadAt]),
  );

  // Newest (non-deleted) message per conversation.
  const lastRows = await db
    .select()
    .from(messages)
    .where(and(inArray(messages.conversationId, convIds), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt));
  const lastByConv = new Map<string, (typeof lastRows)[number]>();
  for (const m of lastRows) {
    if (!lastByConv.has(m.conversationId)) lastByConv.set(m.conversationId, m);
  }
  const shapedLast = await shapeMessages([...lastByConv.values()]);
  const shapedLastMap = new Map(shapedLast.map((m) => [m.conversationId, m]));

  // Unread counts: messages newer than my lastReadAt, not sent by me.
  const unreadMap = new Map<string, number>();
  for (const cid of convIds) {
    const readAt = myReadAt.get(cid) ?? null;
    const [row] = await db
      .select({ c: count() })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, cid),
          isNull(messages.deletedAt),
          ne(messages.senderUserId, meId),
          readAt ? gt(messages.createdAt, readAt) : undefined,
        ),
      );
    unreadMap.set(cid, row?.c ?? 0);
  }

  const participantsByConv = new Map<string, ParticipantLite[]>();
  for (const p of partRows) {
    if (p.userId === meId) continue;
    const u = userMap.get(p.userId);
    if (!u) continue;
    const arr = participantsByConv.get(p.conversationId) ?? [];
    arr.push(u);
    participantsByConv.set(p.conversationId, arr);
  }

  return convIds
    .map((id) => {
      const conv = convMap.get(id);
      if (!conv) return null;
      return {
        id,
        type: conv.type,
        participants: participantsByConv.get(id) ?? [],
        lastMessage: shapedLastMap.get(id) ?? null,
        unreadCount: unreadMap.get(id) ?? 0,
        lastMessageAt: conv.lastMessageAt,
      };
    })
    .filter((x): x is ConversationSummary => x !== null);
}

/** GET /conversations/:id/messages — cursor-paginated thread (newest first). */
router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const meId = req.userId!;
  const conversationId = String(req.params.id);
  if (!(await getParticipant(conversationId, meId))) {
    res.status(403).json({ error: "Not a participant" });
    return;
  }
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const rows = await db
    .select()
    .from(messages)
    .where(
      cursor
        ? and(
            eq(messages.conversationId, conversationId),
            isNull(messages.deletedAt),
            lt(messages.createdAt, cursor),
          )
        : and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)),
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = await shapeMessages(page);
  res.json({
    items,
    nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
  });
});

/** POST /conversations/:id/messages — send a message; pushes it over the socket. */
router.post(
  "/conversations/:id/messages",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const meId = req.userId!;
    const conversationId = String(req.params.id);
    if (!(await getParticipant(conversationId, meId))) {
      res.status(403).json({ error: "Not a participant" });
      return;
    }
    const { body, attachedTrackId, attachedImageUrl } = req.body as {
      body?: unknown;
      attachedTrackId?: unknown;
      attachedImageUrl?: unknown;
    };
    const bodyText = typeof body === "string" ? body : "";
    const trackId = typeof attachedTrackId === "string" ? attachedTrackId : null;
    const imageUrl = typeof attachedImageUrl === "string" ? attachedImageUrl : null;
    if (!bodyText.trim() && !trackId && !imageUrl) {
      res.status(400).json({ error: "A message needs a body, a track, or an image" });
      return;
    }
    if (trackId) {
      const [t] = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId)).limit(1);
      if (!t) {
        res.status(400).json({ error: "attachedTrackId does not exist" });
        return;
      }
    }

    const now = new Date();
    const [msg] = await db
      .insert(messages)
      .values({
        conversationId,
        senderUserId: meId,
        body: bodyText,
        attachedTrackId: trackId,
        attachedImageUrl: imageUrl,
      })
      .returning();
    // Bump conversation activity + mark the sender caught up.
    await db
      .update(conversations)
      .set({ lastMessageAt: now })
      .where(eq(conversations.id, conversationId));
    await db
      .update(conversationParticipants)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, meId),
        ),
      );

    const shaped = await shapeMessage(msg);

    // Fan out: every participant's personal room (so their conversation list and
    // any open thread update), plus the conversation room for typing-scope clients.
    const parts = await db
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));
    for (const p of parts) {
      realtime().emitToUser(p.userId, "dm:message", shaped);
    }
    realtime().emitToRoom(conversationRoom(conversationId), "dm:message", shaped);

    // Notify the other participant(s) (for the bell + background push).
    await notifyMany(
      parts.filter((p) => p.userId !== meId).map((p) => p.userId),
      {
        type: "message",
        actorUserId: meId,
        targetType: "conversation",
        targetId: conversationId,
        body: bodyText.slice(0, 140) || "Sent an attachment",
      },
    );

    res.status(201).json(shaped);
  },
);

/** POST /conversations/:id/read — mark the thread read up to now. */
router.post("/conversations/:id/read", requireAuth, async (req, res): Promise<void> => {
  const meId = req.userId!;
  const conversationId = String(req.params.id);
  if (!(await getParticipant(conversationId, meId))) {
    res.status(403).json({ error: "Not a participant" });
    return;
  }
  const now = new Date();
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: now })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, meId),
      ),
    );
  // Let the other participant(s) update read receipts live.
  realtime().emitToRoom(conversationRoom(conversationId), "dm:read", {
    conversationId,
    userId: meId,
    readAt: now.toISOString(),
  });
  // Also notify the reader's other devices.
  realtime().emitToUser(meId, "dm:read", {
    conversationId,
    userId: meId,
    readAt: now.toISOString(),
  });
  res.json({ ok: true, lastReadAt: now.toISOString() });
});

export default router;
