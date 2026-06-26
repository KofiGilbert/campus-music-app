import { Router, type IRouter } from "express";
import { eq, count, inArray } from "drizzle-orm";
import { db, users, tracks, userLikes } from "@workspace/db";
import { signTracksMedia } from "../lib/trackMedia";

const router: IRouter = Router();

const COVER_COLORS = [
  "#e85d4a", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
  "#6366f1", "#f97316", "#0ea5e9", "#14b8a6", "#ec4899",
];

function colorForIndex(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length];
}

async function getLikeCounts(trackIds: string[]): Promise<Map<string, number>> {
  if (trackIds.length === 0) return new Map();
  const rows = await db
    .select({ trackId: userLikes.trackId, cnt: count() })
    .from(userLikes)
    .where(inArray(userLikes.trackId, trackIds))
    .groupBy(userLikes.trackId);
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.trackId, row.cnt);
  return map;
}

router.get("/users/:id", async (req, res): Promise<void> => {
  // Artists are ordinary users now (role=artist), so there's a single lookup
  // path — the former `user-<artistId>` virtual-ID branch is gone.
  const [user] = await db.select().from(users).where(eq(users.id, req.params.id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let userTracks: (typeof tracks.$inferSelect)[] = [];
  if (user.role === "artist") {
    userTracks = await db.select().from(tracks).where(eq(tracks.artistId, user.id));
  }
  const trackIds = userTracks.map((t) => t.id);
  const likeCounts = await getLikeCounts(trackIds);

  const shapedTracks = await signTracksMedia(
    userTracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: user.name,
      artistId: t.artistId,
      genre: t.genre,
      duration: t.duration,
      durationSeconds: t.durationSeconds,
      coverColor: t.coverColor,
      audioUrl: t.audioUrl ?? null,
      coverUrl: t.coverUrl ?? null,
      playCount: t.playCount,
      likes: likeCounts.get(t.id) ?? 0,
      university: user.university ?? null,
    })),
  );

  res.json({
    id: user.id,
    name: user.name,
    university: user.university ?? "Unknown University",
    role: user.role,
    // Real cover color when the (artist) user has one; deterministic fallback otherwise.
    coverColor: user.coverColor ?? colorForIndex(user.id),
    bio: user.bio || null,
    tracks: shapedTracks,
  });
});

export default router;
