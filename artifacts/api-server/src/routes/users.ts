import { Router, type IRouter, type Request, type Response } from "express";
import { eq, count, inArray } from "drizzle-orm";
import multer from "multer";
import sharp from "sharp";
import { db, users, tracks, userLikes } from "@workspace/db";
import { imageStorage, storageKeys } from "@workspace/storage";
import { signTracksMedia } from "../lib/trackMedia";
import { requireAuth, requireVerified } from "../middlewares/auth";

const router: IRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const AVATAR_SIZES: Record<string, number> = { thumb: 64, medium: 256, full: 512 };
const AVATAR_URL_TTL = 7 * 24 * 60 * 60; // 7d (use IMAGE_CDN_URL in prod for stable URLs)

/**
 * POST /users/me/avatar — multipart single-file avatar upload. Resizes to
 * thumb/medium/full WebP via sharp, stores them in Supabase Storage, and sets
 * users.avatarUrl to the (signed) medium URL.
 */
router.post(
  "/users/me/avatar",
  requireAuth,
  requireVerified,
  upload.single("avatar"),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const file = req.file;
    if (!file || !file.mimetype.startsWith("image/")) {
      res.status(400).json({ error: "An image file is required" });
      return;
    }

    const avatarUrls: Record<string, string> = {};
    for (const [label, size] of Object.entries(AVATAR_SIZES)) {
      const webp = await sharp(file.buffer).resize(size, size, { fit: "cover" }).webp().toBuffer();
      const key = storageKeys.avatar(userId, label);
      await imageStorage.putBuffer(key, webp, "image/webp");
      avatarUrls[label] = await imageStorage.getSignedReadUrl(key, AVATAR_URL_TTL);
    }

    await db
      .update(users)
      .set({ avatarUrl: avatarUrls.medium, updatedAt: new Date() })
      .where(eq(users.id, userId));

    res.json({ avatarUrl: avatarUrls.medium, avatarUrls });
  },
);

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
