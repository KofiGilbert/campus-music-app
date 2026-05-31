import { Router, type IRouter } from "express";
import { desc, eq, inArray, count } from "drizzle-orm";
import { db, tracks, userLikes } from "@workspace/db";

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

  res.json(rows.map((t) => ({ ...t, likes: likeMap.get(t.id) ?? 0 })));
});

router.post("/feed/:id/like", async (req, res): Promise<void> => {
  const [track] = await db.select().from(tracks).where(eq(tracks.id, req.params.id));
  if (!track) {
    res.status(404).json({ error: "Feed item not found" });
    return;
  }
  const { liked } = req.body as { liked?: boolean };
  const [row] = await db
    .select({ cnt: count() })
    .from(userLikes)
    .where(eq(userLikes.trackId, track.id));
  const current = row?.cnt ?? 0;
  const next = liked === false ? Math.max(0, current - 1) : current + 1;
  res.json({ itemId: track.id, likes: next, liked: liked !== false });
});

export default router;
