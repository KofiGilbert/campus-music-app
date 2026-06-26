import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, sql, count, inArray } from "drizzle-orm";
import { db, tracks, userLikes, userLibrary, userPlayback, users } from "@workspace/db";
import { optionalAuth, requireAuth, requireVerified } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { verifyUploadOwner, consumeUploadRecord } from "../lib/uploadRegistry";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const STORAGE_OBJECT_PATH_PATTERN = /\/storage(\/objects\/.+)$/;

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

  const { title, genre, audioUrl, coverUrl, duration, durationSeconds } = req.body as {
    title?: unknown;
    genre?: unknown;
    audioUrl?: unknown;
    coverUrl?: unknown;
    duration?: unknown;
    durationSeconds?: unknown;
  };

  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  if (typeof genre !== "string" || !genre.trim()) {
    res.status(400).json({ error: "Genre is required" });
    return;
  }
  if (typeof audioUrl !== "string" || !audioUrl.trim()) {
    res.status(400).json({ error: "Audio URL is required" });
    return;
  }

  const randomColor = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)];

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
      audioUrl: audioUrl.trim(),
      coverUrl: typeof coverUrl === "string" ? coverUrl : null,
      university: user.university ?? "",
    })
    .returning();

  req.log.info({ trackId: track.id, userId }, "Track created");

  // If the cover URL points to our own object storage, mark it as publicly visible so the
  // /storage/objects/* route will serve it. Cover art is always public — it's displayed to
  // all users. We verify ownership via the upload registry (the objectPath must have been
  // issued to this user by POST /storage/uploads/request-url) before changing visibility.
  if (track.coverUrl) {
    const storageMatch = track.coverUrl.match(STORAGE_OBJECT_PATH_PATTERN);
    if (storageMatch) {
      const objectPath = storageMatch[1];
      if (verifyUploadOwner(objectPath, userId)) {
        try {
          await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
            owner: userId,
            visibility: "public",
          });
          consumeUploadRecord(objectPath);
        } catch (err) {
          req.log.warn({ err, objectPath }, "Could not set public ACL on cover object");
        }
      } else {
        req.log.warn({ objectPath, userId }, "Rejected attempt to publish unowned upload");
      }
    }
  }

  res.status(201).json({ ...track, likes: 0 });
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
  res.json(rows.map((t) => ({ ...t, likes: likeMap.get(t.id) ?? 0 })));
});

router.get("/tracks/trending", async (req, res): Promise<void> => {
  const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 100;
  const limit = isNaN(limitParam) ? 100 : limitParam;

  const trending = await db.select().from(tracks).orderBy(desc(tracks.playCount)).limit(limit);
  const likeMap = await getLikeCountMap(trending.map((t) => t.id));
  res.json(trending.map((t) => ({ ...t, likes: likeMap.get(t.id) ?? 0 })));
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

  res.json(sorted);
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
  res.json({ ...track, likes });
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
  if (coverUrl === null) {
    updates.coverUrl = null;
  } else if (typeof coverUrl === "string" && coverUrl.trim()) {
    const newCoverUrl = coverUrl.trim();
    updates.coverUrl = newCoverUrl;

    const storageMatch = newCoverUrl.match(STORAGE_OBJECT_PATH_PATTERN);
    if (storageMatch) {
      const objectPath = storageMatch[1];
      if (verifyUploadOwner(objectPath, userId)) {
        try {
          await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
            owner: userId,
            visibility: "public",
          });
          consumeUploadRecord(objectPath);
        } catch (err) {
          req.log.warn({ err, objectPath }, "Could not set public ACL on cover object during update");
        }
      } else {
        req.log.warn({ objectPath, userId }, "Rejected attempt to publish unowned upload during track update");
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    const likes = await getLikeCount(track.id);
    res.json({ ...track, likes });
    return;
  }

  const [updated] = await db
    .update(tracks)
    .set(updates)
    .where(eq(tracks.id, track.id))
    .returning();

  req.log.info({ trackId: track.id, userId, updates: Object.keys(updates) }, "Track updated");

  const likes = await getLikeCount(updated.id);
  res.json({ ...updated, likes });
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

router.post("/tracks/:id/play", async (req, res): Promise<void> => {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, req.params.id));
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }

  const [updated] = await db
    .update(tracks)
    .set({ playCount: sql`${tracks.playCount} + 1` })
    .where(eq(tracks.id, track.id))
    .returning({ playCount: tracks.playCount });

  req.log.info({ trackId: track.id, playCount: updated.playCount }, "Play count incremented");

  res.json({ trackId: track.id, playCount: updated.playCount });
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
