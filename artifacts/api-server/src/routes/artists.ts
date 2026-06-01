import { Router, type IRouter, type Request, type Response } from "express";
import { db, artists, artistFollows } from "@workspace/db";
import { and, eq, count } from "drizzle-orm";
import { optionalAuth, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

async function getFollowerCount(artistId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(artistFollows)
    .where(eq(artistFollows.artistId, artistId));
  return row?.count ?? 0;
}

router.get("/artists", optionalAuth, async (req, res): Promise<void> => {
  const userId = req.userId;

  const all = await db.select().from(artists);

  let followedSet = new Set<string>();
  if (userId) {
    const rows = await db.select().from(artistFollows).where(eq(artistFollows.userId, userId));
    followedSet = new Set(rows.map((r) => r.artistId));
  }

  const allCounts = await db
    .select({ artistId: artistFollows.artistId, count: count() })
    .from(artistFollows)
    .groupBy(artistFollows.artistId);
  const countMap = new Map(allCounts.map((r) => [r.artistId, r.count]));

  const result = all.map((a) => ({
    ...a,
    followerCount: countMap.get(a.id) ?? 0,
    following: userId ? followedSet.has(a.id) : undefined,
  }));

  res.json(result);
});

router.get("/artists/followed", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth
  const rows = await db.select().from(artistFollows).where(eq(artistFollows.userId, userId));
  const followedIds = new Set(rows.map((r) => r.artistId));
  const all = await db.select().from(artists);

  const allCounts = await db
    .select({ artistId: artistFollows.artistId, count: count() })
    .from(artistFollows)
    .groupBy(artistFollows.artistId);
  const countMap = new Map(allCounts.map((r) => [r.artistId, r.count]));

  const followed = all
    .filter((a) => followedIds.has(a.id))
    .map((a) => ({
      ...a,
      followerCount: countMap.get(a.id) ?? 0,
      following: true,
    }));

  res.json(followed);
});

router.get("/artists/:id", optionalAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const userId = req.userId;
  const [artist] = await db.select().from(artists).where(eq(artists.id, req.params.id)).limit(1);
  if (!artist) {
    res.status(404).json({ error: "Artist not found" });
    return;
  }

  const followerCount = await getFollowerCount(artist.id);

  let following: boolean | undefined;
  if (userId) {
    const [existing] = await db
      .select()
      .from(artistFollows)
      .where(and(eq(artistFollows.userId, userId), eq(artistFollows.artistId, artist.id)))
      .limit(1);
    following = existing !== undefined;
  }

  res.json({ ...artist, followerCount, following });
});

router.patch("/artists/:id", requireAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const [artist] = await db.select().from(artists).where(eq(artists.id, req.params.id)).limit(1);
  if (!artist) {
    res.status(404).json({ error: "Artist not found" });
    return;
  }

  if (artist.id !== userId) {
    res.status(403).json({ error: "You can only edit your own artist profile" });
    return;
  }

  const body = req.body as { name?: unknown; bio?: unknown; genre?: unknown; university?: unknown };

  const updates: Partial<{ name: string; bio: string; genre: string; university: string }> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      res.status(400).json({ error: "name must be a non-empty string" });
      return;
    }
    updates.name = body.name.trim();
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== "string") {
      res.status(400).json({ error: "bio must be a string" });
      return;
    }
    updates.bio = body.bio.trim();
  }
  if (body.genre !== undefined) {
    if (typeof body.genre !== "string" || body.genre.trim().length === 0) {
      res.status(400).json({ error: "genre must be a non-empty string" });
      return;
    }
    updates.genre = body.genre.trim();
  }
  if (body.university !== undefined) {
    if (typeof body.university !== "string") {
      res.status(400).json({ error: "university must be a string" });
      return;
    }
    updates.university = body.university.trim();
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  await db.update(artists).set(updates).where(eq(artists.id, artist.id));

  const [updated] = await db.select().from(artists).where(eq(artists.id, artist.id)).limit(1);
  const followerCount = await getFollowerCount(artist.id);
  res.json({ ...updated, followerCount, following: undefined });
});

router.post("/artists/:id/follow", requireAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const [artist] = await db.select().from(artists).where(eq(artists.id, req.params.id)).limit(1);
  if (!artist) {
    res.status(404).json({ error: "Artist not found" });
    return;
  }

  const { following } = req.body as { following?: boolean };
  const isFollowing = following !== false;

  const existing = await db
    .select()
    .from(artistFollows)
    .where(and(eq(artistFollows.userId, userId), eq(artistFollows.artistId, artist.id)))
    .limit(1);

  const wasFollowing = existing.length > 0;

  if (isFollowing && !wasFollowing) {
    await db.insert(artistFollows).values({ userId, artistId: artist.id });
  } else if (!isFollowing && wasFollowing) {
    await db
      .delete(artistFollows)
      .where(and(eq(artistFollows.userId, userId), eq(artistFollows.artistId, artist.id)));
  }

  const followerCount = await getFollowerCount(artist.id);
  res.json({ artistId: artist.id, followerCount, following: isFollowing });
});

export default router;
