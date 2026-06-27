import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, showChatMessages, showReminders, shows, users } from "@workspace/db";
import { optionalAuth, requireAdmin, requireAuth, requireVerified } from "../middlewares/auth";
import { cloudflareStream } from "../lib/cloudflareStream";
import { notifyMany } from "../lib/notify";
import { realtime, tvRoom } from "../realtime/gateway";

const router: IRouter = Router();

type ShowRow = typeof shows.$inferSelect;

/** Public show shape — NEVER includes streamKey / rtmpsUrl. */
async function shapeShows(rows: ShowRow[], viewerId: string | null) {
  if (rows.length === 0) return [];
  const hostIds = [...new Set(rows.map((r) => r.hostUserId).filter((x): x is string => !!x))];
  const hostRows = hostIds.length
    ? await db
        .select({ id: users.id, username: users.username, name: users.name, avatarUrl: users.avatarUrl })
        .from(users)
        .where(inArray(users.id, hostIds))
    : [];
  const hostMap = new Map(hostRows.map((h) => [h.id, h]));

  let remindedSet = new Set<string>();
  if (viewerId) {
    const reminded = await db
      .select({ showId: showReminders.showId })
      .from(showReminders)
      .where(and(eq(showReminders.userId, viewerId), inArray(showReminders.showId, rows.map((r) => r.id))));
    remindedSet = new Set(reminded.map((r) => r.showId));
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    status: r.status,
    host: r.hostUserId ? (hostMap.get(r.hostUserId) ?? null) : null,
    featuredUserIds: r.featuredUserIds,
    scheduledAt: r.scheduledAt,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    playbackUrl: r.playbackUrl,
    vodUrl: r.vodUrl,
    thumbnailUrl: r.thumbnailUrl,
    viewerCount: r.viewerCount,
    peakViewerCount: r.peakViewerCount,
    chatEnabled: r.chatEnabled,
    category: r.category,
    tags: r.tags,
    isReminded: viewerId ? remindedSet.has(r.id) : null,
  }));
}

async function loadShow(id: string): Promise<ShowRow | null> {
  const [row] = await db.select().from(shows).where(eq(shows.id, id)).limit(1);
  return row ?? null;
}

const STATUS_FILTER: Record<string, string> = { live: "live", upcoming: "scheduled", replays: "ended" };

/** GET /shows?status=live|upcoming|replays — TV rail. */
router.get("/shows", optionalAuth, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? STATUS_FILTER[req.query.status] : undefined;
  const rows = await db
    .select()
    .from(shows)
    .where(status ? eq(shows.status, status) : undefined)
    .orderBy(desc(shows.scheduledAt), desc(shows.startedAt))
    .limit(50);
  res.json({ items: await shapeShows(rows, req.userId ?? null) });
});

/** GET /shows/:id — one show (public shape). */
router.get("/shows/:id", optionalAuth, async (req, res): Promise<void> => {
  const row = await loadShow(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Show not found" });
    return;
  }
  const [shaped] = await shapeShows([row], req.userId ?? null);
  res.json(shaped);
});

/** POST /shows — schedule a show (admin). */
router.post("/shows", requireAdmin, async (req, res): Promise<void> => {
  const b = req.body as Record<string, unknown>;
  if (typeof b.title !== "string" || !b.title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [created] = await db
    .insert(shows)
    .values({
      title: b.title.trim(),
      description: typeof b.description === "string" ? b.description : "",
      type: typeof b.type === "string" ? b.type : "special",
      status: "scheduled",
      hostUserId: typeof b.hostUserId === "string" ? b.hostUserId : null,
      featuredUserIds: Array.isArray(b.featuredUserIds) ? b.featuredUserIds : [],
      scheduledAt: typeof b.scheduledAt === "string" ? new Date(b.scheduledAt) : null,
      category: typeof b.category === "string" ? b.category : null,
      tags: Array.isArray(b.tags) ? b.tags : [],
      isRecurring: b.isRecurring === true,
      recurringSchedule: b.recurringSchedule ?? null,
      chatEnabled: b.chatEnabled !== false,
    })
    .returning();
  const [shaped] = await shapeShows([created], req.userId ?? null);
  res.status(201).json(shaped);
});

/** POST /shows/:id/start — provision the Cloudflare ingest + go live (admin).
 * Returns the presenter ingest fields (rtmpsUrl + streamKey) — admin only. */
router.post("/shows/:id/start", requireAdmin, async (req, res): Promise<void> => {
  const row = await loadShow(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Show not found" });
    return;
  }
  const input = await cloudflareStream.createLiveInput(`${row.title} (${row.id})`);
  const [updated] = await db
    .update(shows)
    .set({
      status: "live",
      startedAt: new Date(),
      streamId: input.streamId,
      streamKey: input.streamKey,
      rtmpsUrl: input.rtmpsUrl,
      playbackUrl: input.playbackUrl,
      updatedAt: new Date(),
    })
    .where(eq(shows.id, row.id))
    .returning();

  // Notify users who set a reminder that the show is live.
  const reminders = await db
    .select({ userId: showReminders.userId })
    .from(showReminders)
    .where(eq(showReminders.showId, row.id));
  await notifyMany(
    reminders.map((r) => r.userId),
    { type: "show_live", targetType: "show", targetId: row.id, body: `${row.title} is live now`, pushTitle: "Campus Music TV" },
  );

  const [shaped] = await shapeShows([updated], req.userId ?? null);
  res.json({ ...shaped, ingest: { rtmpsUrl: updated.rtmpsUrl, streamKey: updated.streamKey, streamId: updated.streamId } });
});

/** POST /shows/:id/end — end the broadcast + resolve the VOD (admin). */
router.post("/shows/:id/end", requireAdmin, async (req, res): Promise<void> => {
  const row = await loadShow(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Show not found" });
    return;
  }
  const vodUrl = row.streamId ? await cloudflareStream.getVodUrl(row.streamId) : null;
  if (row.streamId) await cloudflareStream.deleteLiveInput(row.streamId);
  const [updated] = await db
    .update(shows)
    .set({ status: "ended", endedAt: new Date(), vodUrl, updatedAt: new Date() })
    .where(eq(shows.id, row.id))
    .returning();
  realtime().emitToRoom(tvRoom(row.id), "tv:ended", { showId: row.id, vodUrl });
  const [shaped] = await shapeShows([updated], req.userId ?? null);
  res.json(shaped);
});

/** POST /shows/:id/remind-me — set a reminder. */
router.post("/shows/:id/remind-me", requireAuth, async (req, res): Promise<void> => {
  const showId = String(req.params.id);
  const row = await loadShow(showId);
  if (!row) {
    res.status(404).json({ error: "Show not found" });
    return;
  }
  await db.insert(showReminders).values({ showId, userId: req.userId! }).onConflictDoNothing();
  res.json({ reminded: true });
});

/** DELETE /shows/:id/remind-me — clear a reminder. */
router.delete("/shows/:id/remind-me", requireAuth, async (req, res): Promise<void> => {
  await db
    .delete(showReminders)
    .where(and(eq(showReminders.showId, String(req.params.id)), eq(showReminders.userId, req.userId!)));
  res.json({ reminded: false });
});

/** GET /shows/:id/chat — recent (non-moderated) chat. */
router.get("/shows/:id/chat", optionalAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: showChatMessages.id,
      showId: showChatMessages.showId,
      userId: showChatMessages.userId,
      displayName: showChatMessages.displayName,
      message: showChatMessages.message,
      type: showChatMessages.type,
      createdAt: showChatMessages.createdAt,
    })
    .from(showChatMessages)
    .where(and(eq(showChatMessages.showId, String(req.params.id)), eq(showChatMessages.isModerated, false)))
    .orderBy(desc(showChatMessages.createdAt))
    .limit(50);
  res.json({ items: rows });
});

/** POST /shows/:id/chat — post a chat message (broadcast over the socket). */
router.post("/shows/:id/chat", requireAuth, requireVerified, async (req, res): Promise<void> => {
  const showId = String(req.params.id);
  const row = await loadShow(showId);
  if (!row || !row.chatEnabled) {
    res.status(404).json({ error: "Show chat unavailable" });
    return;
  }
  const { message } = req.body as { message?: unknown };
  const text = typeof message === "string" ? message.trim().slice(0, 200) : "";
  if (!text) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const [me] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.userId!)).limit(1);
  const [msg] = await db
    .insert(showChatMessages)
    .values({ showId, userId: req.userId!, displayName: me?.name ?? "User", message: text })
    .returning();
  const shaped = {
    id: msg.id,
    showId,
    userId: req.userId!,
    displayName: me?.name ?? "User",
    message: text,
    type: "message",
    createdAt: msg.createdAt,
  };
  realtime().emitToRoom(tvRoom(showId), "tv:chat", shaped);
  res.status(201).json(shaped);
});

/** DELETE /shows/:id/chat/:messageId — moderate a message (admin). */
router.delete("/shows/:id/chat/:messageId", requireAdmin, async (req, res): Promise<void> => {
  await db
    .update(showChatMessages)
    .set({ isModerated: true, moderatedByUserId: req.userId!, moderatedAt: new Date() })
    .where(eq(showChatMessages.id, String(req.params.messageId)));
  realtime().emitToRoom(tvRoom(String(req.params.id)), "tv:chat_removed", { messageId: String(req.params.messageId) });
  res.json({ ok: true });
});

/** POST /shows/:id/join — viewer presence (count + peak). */
router.post("/shows/:id/join", optionalAuth, async (req, res): Promise<void> => {
  const row = await loadShow(String(req.params.id));
  if (!row || row.status !== "live") {
    res.status(404).json({ error: "Show not live" });
    return;
  }
  const [updated] = await db
    .update(shows)
    .set({
      viewerCount: row.viewerCount + 1,
      totalViews: row.totalViews + 1,
      peakViewerCount: sql`greatest(${shows.peakViewerCount}, ${row.viewerCount + 1})`,
    })
    .where(eq(shows.id, row.id))
    .returning();
  realtime().emitToRoom(tvRoom(row.id), "tv:viewers", { showId: row.id, viewerCount: updated.viewerCount });
  res.json({ viewerCount: updated.viewerCount });
});

/** POST /shows/:id/leave — drop viewer presence. */
router.post("/shows/:id/leave", optionalAuth, async (req, res): Promise<void> => {
  const row = await loadShow(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Show not found" });
    return;
  }
  const next = Math.max(0, row.viewerCount - 1);
  await db.update(shows).set({ viewerCount: next }).where(eq(shows.id, row.id));
  realtime().emitToRoom(tvRoom(row.id), "tv:viewers", { showId: row.id, viewerCount: next });
  res.json({ viewerCount: next });
});

export default router;
