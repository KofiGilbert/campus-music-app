import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db, liveChatMessages, liveSessions, users } from "@workspace/db";
import { optionalAuth, requireAuth, requireVerified } from "../middlewares/auth";
import { livekit } from "../lib/livekit";
import { liveRoom, realtime } from "../realtime/gateway";

const router: IRouter = Router();

type SessionRow = typeof liveSessions.$inferSelect;

interface ShapedSession {
  id: string;
  host: { id: string; username: string; name: string; avatarUrl: string | null; role: string } | null;
  title: string;
  status: string;
  transport: string;
  listenerCount: number;
  peakListenerCount: number;
  recordingTrackId: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

async function shapeSessions(rows: SessionRow[]): Promise<ShapedSession[]> {
  if (rows.length === 0) return [];
  const hostIds = [...new Set(rows.map((r) => r.hostUserId))];
  const hostRows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: users.role,
    })
    .from(users)
    .where(inArray(users.id, hostIds));
  const hostMap = new Map(hostRows.map((h) => [h.id, h]));
  return rows.map((r) => ({
    id: r.id,
    host: hostMap.get(r.hostUserId) ?? null,
    title: r.title,
    status: r.status,
    transport: r.transport,
    listenerCount: r.listenerCount,
    peakListenerCount: r.peakListenerCount,
    recordingTrackId: r.recordingTrackId,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
  }));
}

async function loadSession(id: string): Promise<SessionRow | null> {
  const [row] = await db.select().from(liveSessions).where(eq(liveSessions.id, id)).limit(1);
  return row ?? null;
}

/** POST /live/sessions — go live (host). */
router.post("/live/sessions", requireAuth, requireVerified, async (req, res): Promise<void> => {
  const hostUserId = req.userId!;
  const { title } = req.body as { title?: unknown };
  const titleText = typeof title === "string" ? title.trim() : "";

  const [created] = await db
    .insert(liveSessions)
    .values({ hostUserId, title: titleText, status: "live", roomName: "" })
    .returning();
  // Room name embeds the id so it's unique + discoverable.
  const roomName = `live_${created.id}`;
  await db.update(liveSessions).set({ roomName }).where(eq(liveSessions.id, created.id));

  const [shaped] = await shapeSessions([{ ...created, roomName }]);
  res.status(201).json(shaped);
});

/** GET /live/sessions — currently-live sessions, newest first. */
router.get("/live/sessions", optionalAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(liveSessions)
    .where(eq(liveSessions.status, "live"))
    .orderBy(desc(liveSessions.startedAt))
    .limit(50);
  res.json({ items: await shapeSessions(rows) });
});

/** GET /live/sessions/:id — one session. */
router.get("/live/sessions/:id", optionalAuth, async (req, res): Promise<void> => {
  const row = await loadSession(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const [shaped] = await shapeSessions([row]);
  res.json(shaped);
});

/** POST /live/sessions/:id/end — host ends the broadcast. */
router.post("/live/sessions/:id/end", requireAuth, async (req, res): Promise<void> => {
  const row = await loadSession(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (row.hostUserId !== req.userId) {
    res.status(403).json({ error: "Only the host can end the session" });
    return;
  }
  if (row.status === "ended") {
    const [shaped] = await shapeSessions([row]);
    res.json(shaped);
    return;
  }
  const [updated] = await db
    .update(liveSessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(liveSessions.id, row.id))
    .returning();
  realtime().emitToRoom(liveRoom(row.id), "live:ended", { sessionId: row.id });
  // NOTE: live-session -> MP3 auto-publish (LiveKit composite egress -> transcoder
  // -> tracks row -> follower push) is wired here once LiveKit egress credentials
  // are provisioned. Flagged as the remaining credential-gated work in the PR.
  const [shaped] = await shapeSessions([updated]);
  res.json(shaped);
});

/** POST /live/sessions/:id/token — mint a LiveKit token (host can publish). */
router.post("/live/sessions/:id/token", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const row = await loadSession(String(req.params.id));
  if (!row || row.status !== "live") {
    res.status(404).json({ error: "Session not live" });
    return;
  }
  if (!livekit.isEnabled()) {
    res.status(503).json({ error: "Live streaming is not configured" });
    return;
  }
  const isHost = row.hostUserId === userId;
  const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const token = await livekit.mintToken({
    room: row.roomName,
    identity: userId,
    name: me?.name,
    canPublish: isHost,
  });
  res.json({ token, wsUrl: livekit.wsUrl(), room: row.roomName, role: isHost ? "host" : "listener" });
});

/** POST /live/sessions/:id/join — register presence (listener count + peak). */
router.post("/live/sessions/:id/join", requireAuth, async (req, res): Promise<void> => {
  const row = await loadSession(String(req.params.id));
  if (!row || row.status !== "live") {
    res.status(404).json({ error: "Session not live" });
    return;
  }
  const [updated] = await db
    .update(liveSessions)
    .set({
      listenerCount: row.listenerCount + 1,
      peakListenerCount: sql`greatest(${liveSessions.peakListenerCount}, ${row.listenerCount + 1})`,
    })
    .where(eq(liveSessions.id, row.id))
    .returning();
  realtime().emitToRoom(liveRoom(row.id), "live:listeners", {
    sessionId: row.id,
    listenerCount: updated.listenerCount,
  });
  res.json({ listenerCount: updated.listenerCount });
});

/** POST /live/sessions/:id/leave — drop presence. */
router.post("/live/sessions/:id/leave", requireAuth, async (req, res): Promise<void> => {
  const row = await loadSession(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const next = Math.max(0, row.listenerCount - 1);
  await db.update(liveSessions).set({ listenerCount: next }).where(eq(liveSessions.id, row.id));
  realtime().emitToRoom(liveRoom(row.id), "live:listeners", { sessionId: row.id, listenerCount: next });
  res.json({ listenerCount: next });
});

/** GET /live/sessions/:id/chat — recent chat (cursor, newest first). */
router.get("/live/sessions/:id/chat", optionalAuth, async (req, res): Promise<void> => {
  const sessionId = String(req.params.id);
  const cursorRaw = req.query.cursor;
  const cursor = typeof cursorRaw === "string" ? new Date(cursorRaw) : null;
  const validCursor = cursor && !isNaN(cursor.getTime()) ? cursor : null;

  const rows = await db
    .select({
      id: liveChatMessages.id,
      sessionId: liveChatMessages.sessionId,
      body: liveChatMessages.body,
      createdAt: liveChatMessages.createdAt,
      userId: liveChatMessages.userId,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(liveChatMessages)
    .innerJoin(users, eq(users.id, liveChatMessages.userId))
    .where(
      validCursor
        ? and(eq(liveChatMessages.sessionId, sessionId), lt(liveChatMessages.createdAt, validCursor))
        : eq(liveChatMessages.sessionId, sessionId),
    )
    .orderBy(desc(liveChatMessages.createdAt))
    .limit(50);

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      user: { id: r.userId, name: r.userName, avatarUrl: r.userAvatarUrl },
      body: r.body,
      createdAt: r.createdAt,
    })),
    nextCursor: rows.length === 50 ? rows[rows.length - 1].createdAt.toISOString() : null,
  });
});

/** POST /live/sessions/:id/chat — post a chat message (broadcast over socket). */
router.post(
  "/live/sessions/:id/chat",
  requireAuth,
  requireVerified,
  async (req, res): Promise<void> => {
    const userId = req.userId!;
    const sessionId = String(req.params.id);
    const row = await loadSession(sessionId);
    if (!row || row.status !== "live") {
      res.status(404).json({ error: "Session not live" });
      return;
    }
    const { body } = req.body as { body?: unknown };
    const bodyText = typeof body === "string" ? body.trim() : "";
    if (!bodyText) {
      res.status(400).json({ error: "A chat message needs a body" });
      return;
    }
    const [msg] = await db
      .insert(liveChatMessages)
      .values({ sessionId, userId, body: bodyText })
      .returning();
    const [me] = await db
      .select({ name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const shaped = {
      id: msg.id,
      sessionId,
      user: { id: userId, name: me?.name ?? "User", avatarUrl: me?.avatarUrl ?? null },
      body: bodyText,
      createdAt: msg.createdAt,
    };
    realtime().emitToRoom(liveRoom(sessionId), "live:chat", shaped);
    res.status(201).json(shaped);
  },
);

export default router;
