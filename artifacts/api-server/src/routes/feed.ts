import { Router, type IRouter } from "express";
import { desc, inArray, count } from "drizzle-orm";
import { db, tracks, userLikes } from "@workspace/db";
import { signTracksMedia } from "../lib/trackMedia";

const router: IRouter = Router();

router.get("/feed", async (req, res): Promise<void> => {
  const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;

  let rows = await db.select().from(tracks).orderBy(desc(tracks.playCount));
  if (limitParam && !isNaN(limitParam)) rows = rows.slice(0, limitParam);

  if (rows.length === 0) {
    res.json([]);
    return;
  }

  const likeRows = await db
    .select({ trackId: userLikes.trackId, cnt: count() })
    .from(userLikes)
    .where(inArray(userLikes.trackId, rows.map((t) => t.id)))
    .groupBy(userLikes.trackId);
  const likeMap = new Map(likeRows.map((r) => [r.trackId, r.cnt]));

  res.json(await signTracksMedia(rows.map((t) => ({ ...t, likes: likeMap.get(t.id) ?? 0 }))));
});

export default router;
