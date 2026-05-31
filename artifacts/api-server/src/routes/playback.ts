import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userPlayback } from "@workspace/db";
import { verifyToken } from "./auth";

const router: IRouter = Router();

async function requireUserId(req: Parameters<Parameters<typeof router.get>[1]>[0]): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.slice(7));
}

router.get("/playback", async (req, res): Promise<void> => {
  const userId = await requireUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [row] = await db.select().from(userPlayback).where(eq(userPlayback.userId, userId)).limit(1);
  if (!row) {
    res.json({ trackId: null, position: 0 });
    return;
  }

  res.json({ trackId: row.trackId, position: row.position });
});

router.post("/playback", async (req, res): Promise<void> => {
  const userId = await requireUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

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
