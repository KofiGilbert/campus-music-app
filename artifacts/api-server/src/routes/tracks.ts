import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, sql, count, inArray, gte, lt } from "drizzle-orm";
import {
  db,
  tracks,
  userLikes,
  userLibrary,
  userPlayback,
  users,
  uploadJobs,
  playHistory,
  trackSkips,
} from "@workspace/db";
import { optionalAuth, requireAuth, requireVerified } from "../middlewares/auth";
import { signTrackMedia, signTracksMedia } from "../lib/trackMedia";

const router: IRouter = Router();

const COVER_COLORS = [
  "#e85d4a", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
  "#6366f1", "#f97316", "#0ea5e9", "#14b8a6", "#ec4899",
];

async function getLikeCountMap(trackIds: string[]): Promise<Map<string, number>> {
  if (trackIds.length === 0) return new Map();
  const rows = await db
    .select({ trackId: userLikes.trackId, cnt: count() })
    .from(userLikes)
    .where(inArray(userLikes.trackId, trackIds))
    .groupBy(userLikes.trackId);
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.trackId, row.cnt);
  }
  return map;
}

async function getLikeCount(trackId: string): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(userLikes)
    .where(eq(userLikes.trackId, trackId));
  return row?.cnt ?? 0;
}

router.post("/tracks", requireAuth, requireVerified, async (req, res): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth
  // Artist-only — token-side gate before the DB hit (role is in the JWT claim).
  if (req.auth!.role !== "artist") {
    res.status(403).json({ error: "Only artists can upload tracks" });
    return;
  }

  // Still need the row for the denormalized artist name + university on the track.
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const body = req.body as {
    title?: unknown;
    genre?: unknown;
    sourceKey?: unknown;
    coverSourceKey?: unknown;
    // Legacy aliases (full URL or key) accepted for backward compat.
    audioUrl?: unknown;
    coverUrl?: unknown;
    duration?: unknown;
    durationSeconds?: unknown;
  };
  const { title, genre, duration, durationSeconds } = body;
  const sourceKey = typeof body.sourceKey === "string" ? body.sourceKey : body.audioUrl;
  const coverSourceKey =
    typeof body.coverSourceKey === "string" ? body.coverSourceKey : body.coverUrl;

  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  if (typeof genre !== "string" || !genre.trim()) {
    res.status(400).json({ error: "Genre is required" });
    return;
  }
  if (typeof sourceKey !== "string" || !sourceKey.trim()) {
    res.status(400).json({ error: "sourceKey is required" });
    return;
  }

  const randomColor = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];

  // Store R2 object KEYS (not full URLs); resolved to signed URLs at read time.
  // The transcoder will later replace audioUrl/coverUrl with the processed
  // variant keys and populate audioUrls/coverUrls.
  const [track] = await db
    .insert(tracks)
    .values({
      title: title.trim(),
      artist: user.name,
      artistId: user.id,
      genre: genre.trim(),
      duration: typeof duration === "string" ? duration : "0:00",
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : 0,
      coverColor: randomColor,
      audioUrl: sourceKey.trim(),
      coverUrl: typeof coverSourceKey === "string" ? coverSourceKey : null,
      university: user.university ?? "",
      processingStatus: "pending",
    })
    .returning();

  // Enqueue transcoding (the transcoder worker polls upload_jobs).
  await db.insert(uploadJobs).values({ trackId: track.id, sourceKey: sourceKey.trim() });

  req.log.info({ trackId: track.id, userId }, "Track created + transcode job enqueued");

  res.status(201).json({ ...(await signTrackMedia(track)), likes: 0 });
});

router.get("/tracks", async (req, res): Promise<void> => {
  const { genre, limit, university, artistId } = req.query as { genre?: string; limit?: string; university?: string; artistId?: string };

  let rows = await db.select().from(tracks);

  if (genre) rows = rows.filter((t) => t.genre.toLowerCase() === genre.toLowerCase());
  if (university) rows = rows.filter((t) => t.university?.toLowerCase() === university.toLowerCase());
  if (artistId) rows = rows.filter((t) => t.artistId === artistId);
  if (limit) {
    const n = parseInt(limit, 10);
    if (!isNaN(n) && n > 0) rows = rows.slice(0, n);
  }

  const likeMap = await getLikeCountMap(rows.map((t) => t.id));
  res.json(await signTracksMedia(rows.map((t) => ({ ...t, likes: likeMap.get(t.id) ?? 0 }))));
});

router.get("/tracks/trending", async (req, res): Promise<void> => {
  const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 100;
  const limit = isNaN(limitParam) || limitParam <= 0 ? 100 : Math.min(limitParam, 200);
  const daysParam = typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 7;
  const days = isNaN(daysParam) || daysParam <= 0 ? 7 : daysParam;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Rank by plays in the rolling window from play_history.
  const windowCounts = await db
    .select({ trackId: playHistory.trackId, plays: count() })
    .from(playHistory)
    .where(gte(playHistory.playedAt, since))
    .groupBy(playHistory.trackId)
    .orderBy(desc(count()))
    .limit(limit);

  let trending: (typeof tracks.$inferSelect)[];
  if (windowCounts.length > 0) {
    const ids = windowCounts.map((c) => c.trackId);
    const rows = await db.select().from(tracks).where(inArray(tracks.id, ids));
    const byId = new Map(rows.map((r) => [r.id, r]));
    trending = windowCounts
      .map((c) => byId.get(c.trackId))
      .filter((t): t is typeof tracks.$inferSelect => t !== undefined);
  } else {
    // Graceful fallback before play_history has data: all-time playCount.
    trending = await db.select().from(tracks).orderBy(desc(tracks.playCount)).limit(limit);
  }

  const likeMap = await getLikeCountMap(trending.map((t) => t.id));
  res.json(await signTracksMedia(trending.map((t) => ({ ...t, likes: likeMap.get(t.id) ?? 0 }))));
});

router.get("/tracks/most-liked", async (req, res): Promise<void> => {
  const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 200);

  const allTracks = await db.select().from(tracks);
  const likeMap = await getLikeCountMap(allTracks.map((t) => t.id));

  const sorted = allTracks
    .map((t) => ({ ...t, likes: likeMap.get(t.id) ?? 0 }))
    .sort((a, b) => b.likes - a.likes || b.playCount - a.playCount)
    .slice(0, limit);

  res.json(await signTracksMedia(sorted));
});

router.get("/tracks/liked", optionalAuth, async (req, res): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.json([]);
    return;
  }
  const rows = await db
    .select({ trackId: userLikes.trackId })
    .from(userLikes)
    .where(eq(userLikes.userId, userId));
  res.json(rows.map((r) => r.trackId));
});

router.get("/tracks/library", optionalAuth, async (req, res): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.json([]);
    return;
  }
  const rows = await db
    .select({ trackId: userLibrary.trackId })
    .from(userLibrary)
    .where(eq(userLibrary.userId, userId));
  res.json(rows.map((r) => r.trackId));
});

router.get("/tracks/:id", async (req, res): Promise<void> => {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, req.params.id));
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  const likes = await getLikeCount(track.id);
  res.json({ ...(await signTrackMedia(track)), likes });
});

router.patch("/tracks/:id", requireAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const [track] = await db.select().from(tracks).where(eq(tracks.id, req.params.id));
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  if (track.artistId !== userId) {
    res.status(403).json({ error: "You can only edit your own tracks" });
    return;
  }

  const { title, genre, coverUrl } = req.body as {
    title?: unknown;
    genre?: unknown;
    coverUrl?: unknown;
  };

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    res.status(400).json({ error: "Title must be a non-empty string" });
    return;
  }
  if (genre !== undefined && (typeof genre !== "string" || !genre.trim())) {
    res.status(400).json({ error: "Genre must be a non-empty string" });
    return;
  }

  if (coverUrl !== undefined && coverUrl !== null && (typeof coverUrl !== "string" || !coverUrl.trim())) {
    res.status(400).json({ error: "coverUrl must be a non-empty string or null" });
    return;
  }

  const updates: Partial<typeof track> = {};
  if (typeof title === "string" && title.trim()) updates.title = title.trim();
  if (typeof genre === "string" && genre.trim()) updates.genre = genre.trim();
  // coverUrl is now stored as an R2 key (or null); resolved to a signed URL at
  // read time.
  if (coverUrl === null) {
    updates.coverUrl = null;
  } else if (typeof coverUrl === "string" && coverUrl.trim()) {
    updates.coverUrl = coverUrl.trim();
  }

  if (Object.keys(updates).length === 0) {
    const likes = await getLikeCount(track.id);
    res.json({ ...(await signTrackMedia(track)), likes });
    return;
  }

  const [updated] = await db
    .update(tracks)
    .set(updates)
    .where(eq(tracks.id, track.id))
    .returning();

  req.log.info({ trackId: track.id, userId, updates: Object.keys(updates) }, "Track updated");

  const likes = await getLikeCount(updated.id);
  res.json({ ...(await signTrackMedia(updated)), likes });
});

router.delete("/tracks/:id", requireAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const [track] = await db.select().from(tracks).where(eq(tracks.id, req.params.id));
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  if (track.artistId !== userId) {
    res.status(403).json({ error: "You can only delete your own tracks" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(userLikes).where(eq(userLikes.trackId, track.id));
    await tx.delete(userLibrary).where(eq(userLibrary.trackId, track.id));
    await tx.delete(userPlayback).where(eq(userPlayback.trackId, track.id));
    await tx.delete(tracks).where(eq(tracks.id, track.id));
  });

  req.log.info({ trackId: track.id, userId }, "Track deleted");

  res.status(204).send();
});

router.post("/tracks/:id/play", optionalAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const [track] = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.id, req.params.id))
    .limit(1);
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }

  const { secondsListened, completed, source, context } = req.body as {
    secondsListened?: unknown;
    completed?: unknown;
    source?: unknown;
    context?: unknown;
  };

  // Detailed per-listen row for signed-in users; playCount stays as the
  // denormalized all-time counter.
  if (req.userId) {
    await db.insert(playHistory).values({
      userId: req.userId,
      trackId: track.id,
      secondsListened: typeof secondsListened === "number" ? secondsListened : 0,
      completed: completed === true,
      source: typeof source === "string" && source ? source : "unknown",
      context: typeof context === "string" ? context : null,
    });
  }

  const [updated] = await db
    .update(tracks)
    .set({ playCount: sql`${tracks.playCount} + 1` })
    .where(eq(tracks.id, track.id))
    .returning({ playCount: tracks.playCount });

  res.json({ trackId: track.id, playCount: updated.playCount });
});

router.post("/tracks/:id/skip", optionalAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const [track] = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.id, req.params.id))
    .limit(1);
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }

  const { secondsBeforeSkip } = req.body as { secondsBeforeSkip?: unknown };
  if (req.userId) {
    await db.insert(trackSkips).values({
      userId: req.userId,
      trackId: track.id,
      secondsBeforeSkip: typeof secondsBeforeSkip === "number" ? secondsBeforeSkip : 0,
    });
  }

  res.json({ trackId: track.id, recorded: !!req.userId });
});

// Cursor-paginated listening history (cursor = playedAt ISO of the last row).
router.get("/me/history", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const limit = 20;
  const cursor = typeof req.query.cursor === "string" ? new Date(req.query.cursor) : null;
  const validCursor = cursor && !isNaN(cursor.getTime()) ? cursor : null;

  const rows = await db
    .select({ track: tracks, playedAt: playHistory.playedAt, secondsListened: playHistory.secondsListened, completed: playHistory.completed })
    .from(playHistory)
    .innerJoin(tracks, eq(playHistory.trackId, tracks.id))
    .where(
      validCursor
        ? and(eq(playHistory.userId, userId), lt(playHistory.playedAt, validCursor))
        : eq(playHistory.userId, userId),
    )
    .orderBy(desc(playHistory.playedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].playedAt.toISOString() : null;

  const history = await Promise.all(
    page.map(async (r) => ({
      track: await signTrackMedia(r.track),
      playedAt: r.playedAt,
      secondsListened: r.secondsListened,
      completed: r.completed,
    })),
  );

  res.json({ history, nextCursor });
});

router.post("/tracks/:id/like", optionalAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, req.params.id));
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }

  const userId = req.userId;
  const { liked } = req.body as { liked?: boolean };

  if (userId) {
    const existing = await db
      .select()
      .from(userLikes)
      .where(and(eq(userLikes.userId, userId), eq(userLikes.trackId, track.id)))
      .limit(1);

    const isCurrentlyLiked = existing.length > 0;
    const shouldLike = liked !== undefined ? liked : !isCurrentlyLiked;

    if (shouldLike && !isCurrentlyLiked) {
      await db.insert(userLikes).values({ userId, trackId: track.id }).onConflictDoNothing();
    } else if (!shouldLike && isCurrentlyLiked) {
      await db.delete(userLikes).where(and(eq(userLikes.userId, userId), eq(userLikes.trackId, track.id)));
    }

    const likeCount = await db
      .select()
      .from(userLikes)
      .where(eq(userLikes.trackId, track.id));

    res.json({ trackId: track.id, likes: likeCount.length, liked: shouldLike });
    return;
  }

  const likeCount = Math.floor(track.playCount / 10);
  const isLiked = liked !== false;
  res.json({ trackId: track.id, likes: isLiked ? likeCount + 1 : Math.max(0, likeCount - 1), liked: isLiked });
});

router.post("/tracks/:id/library", requireAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const [track] = await db.select().from(tracks).where(eq(tracks.id, req.params.id));
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }

  const { saved } = req.body as { saved?: boolean };

  const existing = await db
    .select()
    .from(userLibrary)
    .where(and(eq(userLibrary.userId, userId), eq(userLibrary.trackId, track.id)))
    .limit(1);

  const isCurrentlySaved = existing.length > 0;
  const shouldSave = saved !== undefined ? saved : !isCurrentlySaved;

  if (shouldSave && !isCurrentlySaved) {
    await db.insert(userLibrary).values({ userId, trackId: track.id }).onConflictDoNothing();
  } else if (!shouldSave && isCurrentlySaved) {
    await db.delete(userLibrary).where(and(eq(userLibrary.userId, userId), eq(userLibrary.trackId, track.id)));
  }

  res.json({ trackId: track.id, saved: shouldSave });
});

export default router;
