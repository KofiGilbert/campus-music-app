import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import {
  comments,
  db,
  flags,
  liveSessions,
  playHistory,
  posts,
  tracks,
  users,
} from "@workspace/db";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { notifyMany } from "../lib/notify";

const router: IRouter = Router();

const adminUserCols = {
  id: users.id,
  username: users.username,
  name: users.name,
  email: users.email,
  role: users.role,
  university: users.university,
  verified: users.verified,
  isAdmin: users.isAdmin,
  isSystem: users.isSystem,
  bannedAt: users.bannedAt,
  createdAt: users.createdAt,
};

// ─── Public: report content ───────────────────────────────────────────────────

/** POST /flags — report a post/track/comment/user (any authed user). */
router.post("/flags", requireAuth, async (req, res): Promise<void> => {
  const { targetType, targetId, reason } = req.body as {
    targetType?: unknown;
    targetId?: unknown;
    reason?: unknown;
  };
  if (
    (targetType !== "post" && targetType !== "track" && targetType !== "comment" && targetType !== "user") ||
    typeof targetId !== "string" ||
    !targetId
  ) {
    res.status(400).json({ error: "targetType (post|track|comment|user) and targetId are required" });
    return;
  }
  const [created] = await db
    .insert(flags)
    .values({
      reporterUserId: req.userId!,
      targetType,
      targetId,
      reason: typeof reason === "string" ? reason.slice(0, 500) : "",
    })
    .returning();
  res.status(201).json({ id: created.id, ok: true });
});

// ─── Admin: users ───────────────────────────────────────────────────────────

/** GET /admin/users?q= — search/list users. */
router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db
    .select(adminUserCols)
    .from(users)
    .where(q ? or(ilike(users.name, like), ilike(users.username, like), ilike(users.email, like)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);
  res.json({ items: rows });
});

/** POST /admin/users/:id/ban — set/clear the ban. */
router.post("/admin/users/:id/ban", requireAdmin, async (req, res): Promise<void> => {
  const { banned } = req.body as { banned?: unknown };
  const id = String(req.params.id);
  await db
    .update(users)
    .set({ bannedAt: banned === false ? null : new Date() })
    .where(eq(users.id, id));
  const [row] = await db.select(adminUserCols).from(users).where(eq(users.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(row);
});

/** POST /admin/users/:id/verify — toggle the blue check. */
router.post("/admin/users/:id/verify", requireAdmin, async (req, res): Promise<void> => {
  const { verified } = req.body as { verified?: unknown };
  const id = String(req.params.id);
  await db.update(users).set({ verified: verified !== false }).where(eq(users.id, id));
  const [row] = await db.select(adminUserCols).from(users).where(eq(users.id, id)).limit(1);
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(row);
});

// ─── Admin: tracks ────────────────────────────────────────────────────────────

/** GET /admin/tracks?q= — list/search tracks. */
router.get("/admin/tracks", requireAdmin, async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      artist: tracks.artist,
      artistId: tracks.artistId,
      genre: tracks.genre,
      university: tracks.university,
      playCount: tracks.playCount,
      processingStatus: tracks.processingStatus,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .where(q ? or(ilike(tracks.title, like), ilike(tracks.artist, like)) : undefined)
    .orderBy(desc(tracks.createdAt))
    .limit(100);
  res.json({ items: rows });
});

/** DELETE /admin/tracks/:id — take a track down. */
router.delete("/admin/tracks/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.delete(tracks).where(eq(tracks.id, String(req.params.id)));
  res.status(204).end();
});

// ─── Admin: posts + comments moderation ───────────────────────────────────────

/** GET /admin/posts — recent posts. */
router.get("/admin/posts", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({ id: posts.id, authorUserId: posts.authorUserId, body: posts.body, type: posts.type, createdAt: posts.createdAt })
    .from(posts)
    .where(isNull(posts.deletedAt))
    .orderBy(desc(posts.createdAt))
    .limit(100);
  res.json({ items: rows });
});

/** DELETE /admin/posts/:id — soft-delete a post. */
router.delete("/admin/posts/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, String(req.params.id)));
  res.status(204).end();
});

/** GET /admin/comments — recent comments. */
router.get("/admin/comments", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: comments.id,
      authorUserId: comments.authorUserId,
      targetType: comments.targetType,
      targetId: comments.targetId,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(isNull(comments.deletedAt))
    .orderBy(desc(comments.createdAt))
    .limit(100);
  res.json({ items: rows });
});

/** DELETE /admin/comments/:id — soft-delete a comment. */
router.delete("/admin/comments/:id", requireAdmin, async (req, res): Promise<void> => {
  await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, String(req.params.id)));
  res.status(204).end();
});

// ─── Admin: flag queue ────────────────────────────────────────────────────────

/** GET /admin/flags?status=open — moderation queue. */
router.get("/admin/flags", requireAdmin, async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "open";
  const rows = await db
    .select({
      id: flags.id,
      targetType: flags.targetType,
      targetId: flags.targetId,
      reason: flags.reason,
      status: flags.status,
      createdAt: flags.createdAt,
      reporterId: flags.reporterUserId,
      reporterName: users.name,
    })
    .from(flags)
    .innerJoin(users, eq(users.id, flags.reporterUserId))
    .where(eq(flags.status, status))
    .orderBy(desc(flags.createdAt))
    .limit(100);
  res.json({ items: rows });
});

/** POST /admin/flags/:id/resolve — resolve/dismiss a flag. */
router.post("/admin/flags/:id/resolve", requireAdmin, async (req, res): Promise<void> => {
  const { status } = req.body as { status?: unknown };
  const next = status === "dismissed" ? "dismissed" : "resolved";
  await db
    .update(flags)
    .set({ status: next, resolvedByUserId: req.userId!, resolvedAt: new Date() })
    .where(eq(flags.id, String(req.params.id)));
  res.json({ ok: true, status: next });
});

// ─── Admin: live sessions monitor ─────────────────────────────────────────────

/** GET /admin/live-sessions — currently-live sessions. */
router.get("/admin/live-sessions", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: liveSessions.id,
      hostUserId: liveSessions.hostUserId,
      title: liveSessions.title,
      listenerCount: liveSessions.listenerCount,
      startedAt: liveSessions.startedAt,
    })
    .from(liveSessions)
    .where(eq(liveSessions.status, "live"))
    .orderBy(desc(liveSessions.startedAt));
  res.json({ items: rows });
});

/** POST /admin/live-sessions/:id/end — force-end a session. */
router.post("/admin/live-sessions/:id/end", requireAdmin, async (req, res): Promise<void> => {
  await db
    .update(liveSessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(liveSessions.id, String(req.params.id)));
  res.json({ ok: true });
});

// ─── Admin: analytics ─────────────────────────────────────────────────────────

/** GET /admin/analytics — headline counts + 14-day signups/plays/live series. */
router.get("/admin/analytics", requireAdmin, async (_req, res): Promise<void> => {
  const [[{ totalUsers }], [{ totalArtists }], [{ totalTracks }], [{ totalPosts }], [{ liveNow }]] =
    await Promise.all([
      db.select({ totalUsers: count() }).from(users),
      db.select({ totalArtists: count() }).from(users).where(eq(users.role, "artist")),
      db.select({ totalTracks: count() }).from(tracks),
      db.select({ totalPosts: count() }).from(posts).where(isNull(posts.deletedAt)),
      db.select({ liveNow: count() }).from(liveSessions).where(eq(liveSessions.status, "live")),
    ]);

  const signups = await db.execute(
    sql`select to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD') as day, count(*)::int as n
        from ${users} where ${users.createdAt} > now() - interval '14 days'
        group by day order by day`,
  );
  const plays = await db.execute(
    sql`select to_char(date_trunc('day', ${playHistory.playedAt}), 'YYYY-MM-DD') as day, count(*)::int as n
        from ${playHistory} where ${playHistory.playedAt} > now() - interval '14 days'
        group by day order by day`,
  );

  res.json({
    totals: {
      users: totalUsers,
      artists: totalArtists,
      tracks: totalTracks,
      posts: totalPosts,
      liveNow,
    },
    signupsByDay: signups.rows as { day: string; n: number }[],
    playsByDay: plays.rows as { day: string; n: number }[],
  });
});

// ─── Admin: push broadcast ────────────────────────────────────────────────────

/** POST /admin/broadcast — announcement to all users (or a role segment). */
router.post("/admin/broadcast", requireAdmin, async (req, res): Promise<void> => {
  const { title, body, segment } = req.body as { title?: unknown; body?: unknown; segment?: unknown };
  if (typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "body is required" });
    return;
  }
  const seg = segment === "artist" || segment === "listener" ? segment : null;
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isSystem, false), seg ? eq(users.role, seg) : undefined));
  await notifyMany(
    recipients.map((r) => r.id),
    {
      type: "announcement",
      targetType: "announcement",
      targetId: null,
      body: body.trim(),
      pushTitle: typeof title === "string" && title.trim() ? title.trim() : "Campus Music",
    },
  );
  res.json({ ok: true, recipients: recipients.length });
});

export default router;
