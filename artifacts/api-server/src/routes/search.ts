import { Router, type IRouter } from "express";
import { count, inArray } from "drizzle-orm";
import { db, userLikes } from "@workspace/db";
import { signTracksMedia } from "../lib/trackMedia";
import { searchProvider, type SearchFacet, type TrackRow } from "../lib/search";

const router: IRouter = Router();

async function addLikesToTracks(rows: TrackRow[]): Promise<(TrackRow & { likes: number })[]> {
  if (rows.length === 0) return [];
  const likeRows = await db
    .select({ trackId: userLikes.trackId, cnt: count() })
    .from(userLikes)
    .where(
      inArray(
        userLikes.trackId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(userLikes.trackId);
  const likeMap = new Map(likeRows.map((r) => [r.trackId, r.cnt]));
  return rows.map((r) => ({ ...r, likes: likeMap.get(r.id) ?? 0 }));
}

function parseFacet(value: unknown): SearchFacet {
  if (value === "tracks" || value === "artists" || value === "users" || value === "universities") return value;
  return "all";
}

// GET /search?q=&type=all|tracks|artists|users|universities — faceted full-text
// search. Response keeps `tracks` + `artists` (backward compatible) and adds
// `users` + `universities`.
router.get("/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const facet = parseFacet(req.query.type);

  if (!q) {
    res.json({ tracks: [], artists: [], users: [], universities: [] });
    return;
  }

  const results = await searchProvider.search(q, facet, 15);
  const tracksWithLikes = await addLikesToTracks(results.tracks);

  res.json({
    tracks: await signTracksMedia(tracksWithLikes),
    artists: results.artists,
    users: results.users,
    universities: results.universities,
  });
});

export default router;
