import { Router, type IRouter, type Response } from "express";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { db, playlistTracks, playlists, tracks, userLikes, users } from "@workspace/db";
import { optionalAuth, requireAuth } from "../middlewares/auth";
import { signTracksMedia } from "../lib/trackMedia";

const router: IRouter = Router();

type PlaylistRow = typeof playlists.$inferSelect;
type TrackRow = typeof tracks.$inferSelect;

const LIKED_ID = "liked";

async function addLikes(rows: TrackRow[]): Promise<(TrackRow & { likes: number })[]> {
  if (rows.length === 0) return [];
  const likeRows = await db
    .select({ trackId: userLikes.trackId, c: count() })
    .from(userLikes)
    .where(inArray(userLikes.trackId, rows.map((r) => r.id)))
    .groupBy(userLikes.trackId);
  const likeMap = new Map(likeRows.map((r) => [r.trackId, r.c]));
  return rows.map((r) => ({ ...r, likes: likeMap.get(r.id) ?? 0 }));
}

async function shapePlaylists(rows: PlaylistRow[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const ownerIds = [...new Set(rows.map((r) => r.ownerUserId))];

  const owners = await db
    .select({ id: users.id, username: users.username, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, ownerIds));
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  const counts = await db
    .select({ k: playlistTracks.playlistId, c: count() })
    .from(playlistTracks)
    .where(inArray(playlistTracks.playlistId, ids))
    .groupBy(playlistTracks.playlistId);
  const countMap = new Map(counts.map((r) => [r.k, r.c]));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    coverColor: r.coverColor,
    isPublic: r.isPublic,
    isLikedSongs: false,
    owner: ownerMap.get(r.ownerUserId) ?? null,
    trackCount: countMap.get(r.id) ?? 0,
    createdAt: r.createdAt,
  }));
}

async function likedSongsSummary(userId: string) {
  const [{ c }] = await db.select({ c: count() }).from(userLikes).where(eq(userLikes.userId, userId));
  return {
    id: LIKED_ID,
    name: "Liked Songs",
    description: "Tracks you've liked",
    coverColor: "#e0245e",
    isPublic: false,
    isLikedSongs: true,
    owner: null,
    trackCount: c,
    createdAt: new Date(0).toISOString(),
  };
}

async function loadPlaylist(id: string): Promise<PlaylistRow | null> {
  const [row] = await db.select().from(playlists).where(eq(playlists.id, id)).limit(1);
  return row ?? null;
}

/** POST /playlists — create a playlist. */
router.post("/playlists", requireAuth, async (req, res): Promise<void> => {
  const { name, description, isPublic, coverColor } = req.body as {
    name?: unknown;
    description?: unknown;
    isPublic?: unknown;
    coverColor?: unknown;
  };
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [created] = await db
    .insert(playlists)
    .values({
      ownerUserId: req.userId!,
      name: name.trim(),
      description: typeof description === "string" ? description : "",
      isPublic: isPublic === true,
      coverColor: typeof coverColor === "string" ? coverColor : null,
    })
    .returning();
  const [shaped] = await shapePlaylists([created]);
  res.status(201).json(shaped);
});

/** GET /playlists — my playlists, with the virtual Liked Songs first. */
router.get("/playlists", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(playlists)
    .where(eq(playlists.ownerUserId, req.userId!))
    .orderBy(desc(playlists.createdAt));
  const items = await shapePlaylists(rows);
  res.json({ items: [await likedSongsSummary(req.userId!), ...items] });
});

/** GET /playlists/:id — playlist with its tracks. "liked" = virtual Liked Songs. */
router.get("/playlists/:id", optionalAuth, async (req, res): Promise<void> => {
  const id = String(req.params.id);

  if (id === LIKED_ID) {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const likedRows = await db
      .select({ track: tracks })
      .from(userLikes)
      .innerJoin(tracks, eq(tracks.id, userLikes.trackId))
      .where(eq(userLikes.userId, req.userId))
      .orderBy(desc(userLikes.createdAt));
    const withLikes = await addLikes(likedRows.map((r) => r.track));
    const signed = await signTracksMedia(withLikes);
    res.json({
      ...(await likedSongsSummary(req.userId)),
      tracks: signed,
      entries: signed.map((t, i) => ({ entryId: t.id, trackId: t.id, position: i })),
    });
    return;
  }

  const row = await loadPlaylist(id);
  if (!row) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  if (!row.isPublic && row.ownerUserId !== req.userId) {
    res.status(403).json({ error: "This playlist is private" });
    return;
  }

  const entries = await db
    .select()
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, id))
    .orderBy(asc(playlistTracks.position));
  const trackRows = entries.length
    ? await db.select().from(tracks).where(inArray(tracks.id, [...new Set(entries.map((e) => e.trackId))]))
    : [];
  const trackMap = new Map((await signTracksMedia(await addLikes(trackRows))).map((t) => [t.id, t]));

  const [shaped] = await shapePlaylists([row]);
  res.json({
    ...shaped,
    tracks: entries.map((e) => trackMap.get(e.trackId)).filter(Boolean),
    entries: entries.map((e) => ({ entryId: e.id, trackId: e.trackId, position: e.position })),
  });
});

/** PATCH /playlists/:id — rename / edit (owner). */
router.patch("/playlists/:id", requireAuth, async (req, res): Promise<void> => {
  const row = await loadPlaylist(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  if (row.ownerUserId !== req.userId) {
    res.status(403).json({ error: "Not your playlist" });
    return;
  }
  const { name, description, isPublic, coverColor } = req.body as {
    name?: unknown;
    description?: unknown;
    isPublic?: unknown;
    coverColor?: unknown;
  };
  const patch: Partial<typeof playlists.$inferInsert> = { updatedAt: new Date() };
  if (typeof name === "string" && name.trim()) patch.name = name.trim();
  if (typeof description === "string") patch.description = description;
  if (typeof isPublic === "boolean") patch.isPublic = isPublic;
  if (typeof coverColor === "string") patch.coverColor = coverColor;
  const [updated] = await db.update(playlists).set(patch).where(eq(playlists.id, row.id)).returning();
  const [shaped] = await shapePlaylists([updated]);
  res.json(shaped);
});

/** DELETE /playlists/:id — delete (owner). */
router.delete("/playlists/:id", requireAuth, async (req, res): Promise<void> => {
  const row = await loadPlaylist(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Playlist not found" });
    return;
  }
  if (row.ownerUserId !== req.userId) {
    res.status(403).json({ error: "Not your playlist" });
    return;
  }
  await db.delete(playlists).where(eq(playlists.id, row.id));
  res.status(204).end();
});

/** Owner-guarded playlist load shared by the track-mutation routes. */
async function requireOwnedPlaylist(
  id: string,
  userId: string,
  res: Response,
): Promise<PlaylistRow | null> {
  const row = await loadPlaylist(id);
  if (!row) {
    res.status(404).json({ error: "Playlist not found" });
    return null;
  }
  if (row.ownerUserId !== userId) {
    res.status(403).json({ error: "Not your playlist" });
    return null;
  }
  return row;
}

/** POST /playlists/:id/tracks — append a track (owner). */
router.post("/playlists/:id/tracks", requireAuth, async (req, res): Promise<void> => {
  const playlist = await requireOwnedPlaylist(String(req.params.id), req.userId!, res);
  if (!playlist) return;
  const { trackId } = req.body as { trackId?: unknown };
  if (typeof trackId !== "string" || !trackId) {
    res.status(400).json({ error: "trackId is required" });
    return;
  }
  const [track] = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!track) {
    res.status(400).json({ error: "track does not exist" });
    return;
  }
  const [{ c }] = await db
    .select({ c: count() })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlist.id));
  await db.insert(playlistTracks).values({ playlistId: playlist.id, trackId, position: c });
  await db.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, playlist.id));
  res.status(201).json({ ok: true, trackCount: c + 1 });
});

/** DELETE /playlists/:id/tracks/:trackId — remove a track (owner) + re-densify. */
router.delete("/playlists/:id/tracks/:trackId", requireAuth, async (req, res): Promise<void> => {
  const playlist = await requireOwnedPlaylist(String(req.params.id), req.userId!, res);
  if (!playlist) return;
  await db
    .delete(playlistTracks)
    .where(and(eq(playlistTracks.playlistId, playlist.id), eq(playlistTracks.trackId, String(req.params.trackId))));
  // Re-densify positions.
  const remaining = await db
    .select({ id: playlistTracks.id })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlist.id))
    .orderBy(asc(playlistTracks.position));
  await Promise.all(
    remaining.map((e, i) => db.update(playlistTracks).set({ position: i }).where(eq(playlistTracks.id, e.id))),
  );
  await db.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, playlist.id));
  res.json({ ok: true });
});

/** PUT /playlists/:id/tracks/order — reorder by entry ids (owner). */
router.put("/playlists/:id/tracks/order", requireAuth, async (req, res): Promise<void> => {
  const playlist = await requireOwnedPlaylist(String(req.params.id), req.userId!, res);
  if (!playlist) return;
  const { entryIds } = req.body as { entryIds?: unknown };
  if (!Array.isArray(entryIds) || entryIds.some((x) => typeof x !== "string")) {
    res.status(400).json({ error: "entryIds (string[]) is required" });
    return;
  }
  const existing = await db
    .select({ id: playlistTracks.id })
    .from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlist.id));
  const valid = new Set(existing.map((e) => e.id));
  const order = (entryIds as string[]).filter((id) => valid.has(id));
  await Promise.all(
    order.map((id, i) => db.update(playlistTracks).set({ position: i }).where(eq(playlistTracks.id, id))),
  );
  await db.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, playlist.id));
  res.json({ ok: true });
});

export default router;
