import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userPlayback } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/playback", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const [row] = await db.select().from(userPlayback).where(eq(userPlayback.userId, userId)).limit(1);
  if (!row) {
    res.json({ trackId: null, position: 0 });
    return;
  }

  res.json({ trackId: row.trackId, position: row.position });
});

router.post("/playback", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const { trackId, position } = req.body as { trackId?: unknown; position?: unknown };

  if (typeof trackId !== "string" || !trackId.trim()) {
    res.status(400).json({ error: "trackId is required" });
    return;
  }
  if (typeof position !== "number" || position < 0) {
    res.status(400).json({ error: "position must be a non-negative number" });
    return;
  }

  await db
    .insert(userPlayback)
    .values({ userId, trackId: trackId.trim(), position })
    .onConflictDoUpdate({
      target: userPlayback.userId,
      set: { trackId: trackId.trim(), position, updatedAt: new Date() },
    });

  req.log.info({ userId, trackId, position }, "Playback state saved");
  res.json({ trackId: trackId.trim(), position });
});

export default router;
