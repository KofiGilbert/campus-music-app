import { Router, type IRouter } from "express";
import { inArray, count, eq } from "drizzle-orm";
import { db, tracks, users, userLikes } from "@workspace/db";

const router: IRouter = Router();

async function addLikesToTracks<T extends { id: string }>(rows: T[]): Promise<(T & { likes: number })[]> {
  if (rows.length === 0) return [];
  const likeRows = await db
    .select({ trackId: userLikes.trackId, cnt: count() })
    .from(userLikes)
    .where(inArray(userLikes.trackId, rows.map((r) => r.id)))
    .groupBy(userLikes.trackId);
  const likeMap = new Map(likeRows.map((r) => [r.trackId, r.cnt]));
  return rows.map((r) => ({ ...r, likes: likeMap.get(r.id) ?? 0 }));
}

router.get("/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.toLowerCase().trim() : "";

  if (!q) {
    res.json({ tracks: [], artists: [] });
    return;
  }

  const [allTracks, allArtists] = await Promise.all([
    db.select().from(tracks),
    db
      .select({
        id: users.id,
        name: users.name,
        genre: users.genre,
        university: users.university,
        coverColor: users.coverColor,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
      })
      .from(users)
      .where(eq(users.role, "artist")),
  ]);

  const matchedTracks = allTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.genre.toLowerCase().includes(q) ||
      (t.university?.toLowerCase().includes(q) ?? false)
  );

  const matchedArtists = allArtists
    .filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.genre?.toLowerCase().includes(q) ?? false) ||
        (a.university?.toLowerCase().includes(q) ?? false)
    )
    .map((a) => ({ ...a, genre: a.genre ?? "", coverColor: a.coverColor ?? "" }));

  const tracksWithLikes = await addLikesToTracks(matchedTracks);
  res.json({ tracks: tracksWithLikes, artists: matchedArtists });
});

export default router;
