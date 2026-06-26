import { Router, type IRouter } from "express";
import { and, count, desc, eq, gt, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, playHistory, tracks, userConnections, userLikes, users } from "@workspace/db";
import { optionalAuth, requireAuth } from "../middlewares/auth";
import { signTracksMedia } from "../lib/trackMedia";

const router: IRouter = Router();

type TrackRow = typeof tracks.$inferSelect;

async function signByIds(ids: string[]): Promise<Map<string, TrackRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(tracks).where(inArray(tracks.id, ids));
  const signed = await signTracksMedia(rows);
  return new Map(signed.map((t) => [t.id, t]));
}

/** GET /discovery/now-listening — the latest track each user played recently. */
router.get("/discovery/now-listening", optionalAuth, async (_req, res): Promise<void> => {
  // One row per user: their most recent play in the last hour.
  const recent = await db
    .selectDistinctOn([playHistory.userId], {
      userId: playHistory.userId,
      trackId: playHistory.trackId,
      playedAt: playHistory.playedAt,
    })
    .from(playHistory)
    .where(gt(playHistory.playedAt, sql`now() - interval '60 minutes'`))
    .orderBy(playHistory.userId, desc(playHistory.playedAt))
    .limit(30);

  if (recent.length === 0) {
    res.json({ items: [] });
    return;
  }

  const trackMap = await signByIds([...new Set(recent.map((r) => r.trackId))]);
  const userRows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      avatarUrl: users.avatarUrl,
      university: users.university,
      role: users.role,
    })
    .from(users)
    .where(inArray(users.id, [...new Set(recent.map((r) => r.userId))]));
  const userMap = new Map(userRows.map((u) => [u.id, u]));

  const items = recent
    .map((r) => {
      const user = userMap.get(r.userId);
      const track = trackMap.get(r.trackId);
      if (!user || !track) return null;
      return { user, track, playedAt: r.playedAt };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // Newest first.
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());

  res.json({ items });
});

/** GET /discovery/trending?dimension=country|university — top tracks per group
 * over the last 7 days, grouped by the listener's country / university. */
router.get("/discovery/trending", optionalAuth, async (req, res): Promise<void> => {
  const dimension = req.query.dimension === "university" ? "university" : "country";
  const dimCol = dimension === "university" ? users.university : users.country;

  const rows = await db
    .select({ key: dimCol, trackId: playHistory.trackId, plays: count() })
    .from(playHistory)
    .innerJoin(users, eq(users.id, playHistory.userId))
    .where(and(gt(playHistory.playedAt, sql`now() - interval '7 days'`), isNotNull(dimCol)))
    .groupBy(dimCol, playHistory.trackId);

  // Group by dimension key in app code: top 6 tracks per group, top 6 groups.
  const byKey = new Map<string, { trackId: string; plays: number }[]>();
  const totalByKey = new Map<string, number>();
  for (const r of rows) {
    if (!r.key) continue;
    const arr = byKey.get(r.key) ?? [];
    arr.push({ trackId: r.trackId, plays: r.plays });
    byKey.set(r.key, arr);
    totalByKey.set(r.key, (totalByKey.get(r.key) ?? 0) + r.plays);
  }

  const topKeys = [...totalByKey.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);

  const allTrackIds = new Set<string>();
  for (const k of topKeys) {
    for (const t of (byKey.get(k) ?? []).sort((a, b) => b.plays - a.plays).slice(0, 6)) {
      allTrackIds.add(t.trackId);
    }
  }
  const trackMap = await signByIds([...allTrackIds]);

  const groups = topKeys.map((key) => ({
    key,
    plays: totalByKey.get(key) ?? 0,
    tracks: (byKey.get(key) ?? [])
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 6)
      .map((t) => trackMap.get(t.trackId))
      .filter((t): t is TrackRow => !!t),
  }));

  res.json({ dimension, groups });
});

/** GET /discovery/for-you — tracks liked by your connections + same-university
 * trending, excluding tracks you already liked. SQL-only (not the recs engine). */
router.get("/discovery/for-you", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;

  const [me] = await db.select({ university: users.university }).from(users).where(eq(users.id, userId)).limit(1);

  // Tracks I already like (to exclude).
  const myLikes = await db.select({ trackId: userLikes.trackId }).from(userLikes).where(eq(userLikes.userId, userId));
  const mineSet = new Set(myLikes.map((l) => l.trackId));

  // Accepted connections.
  const conns = await db
    .select({ from: userConnections.fromUserId, to: userConnections.toUserId })
    .from(userConnections)
    .where(and(eq(userConnections.status, "accepted"), sql`(${userConnections.fromUserId} = ${userId} or ${userConnections.toUserId} = ${userId})`));
  const connIds = conns.map((c) => (c.from === userId ? c.to : c.from));

  const candidate = new Map<string, number>(); // trackId -> score

  // Liked by my connections (strong signal).
  if (connIds.length) {
    const likedByConns = await db
      .select({ trackId: userLikes.trackId, c: count() })
      .from(userLikes)
      .where(inArray(userLikes.userId, connIds))
      .groupBy(userLikes.trackId);
    for (const r of likedByConns) candidate.set(r.trackId, (candidate.get(r.trackId) ?? 0) + r.c * 2);
  }

  // Same-university trending (last 7 days).
  if (me?.university) {
    const sameUniTrending = await db
      .select({ trackId: playHistory.trackId, c: count() })
      .from(playHistory)
      .innerJoin(users, eq(users.id, playHistory.userId))
      .where(
        and(
          gt(playHistory.playedAt, sql`now() - interval '7 days'`),
          eq(users.university, me.university),
          ne(playHistory.userId, userId),
        ),
      )
      .groupBy(playHistory.trackId);
    for (const r of sameUniTrending) candidate.set(r.trackId, (candidate.get(r.trackId) ?? 0) + r.c);
  }

  const ranked = [...candidate.entries()]
    .filter(([trackId]) => !mineSet.has(trackId))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([trackId]) => trackId);

  const trackMap = await signByIds(ranked);
  res.json({ tracks: ranked.map((id) => trackMap.get(id)).filter((t): t is TrackRow => !!t) });
});

export default router;
