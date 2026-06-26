import { Router, type IRouter } from "express";
import { and, count, desc, eq, inArray, lt } from "drizzle-orm";
import { audioStorage, imageStorage } from "@workspace/storage";
import { db, podcastEpisodes, podcastSubscriptions, podcasts, users } from "@workspace/db";
import { optionalAuth, requireAuth, requireVerified } from "../middlewares/auth";
import { notifyMany } from "../lib/notify";

const router: IRouter = Router();

type PodcastRow = typeof podcasts.$inferSelect;
type EpisodeRow = typeof podcastEpisodes.$inferSelect;

function isHttp(v: string): boolean {
  return v.startsWith("http://") || v.startsWith("https://");
}
async function signAudio(key: string): Promise<string> {
  return isHttp(key) ? key : audioStorage.getSignedReadUrl(key);
}
async function signCover(key: string | null): Promise<string | null> {
  if (!key) return null;
  return isHttp(key) ? key : imageStorage.getSignedReadUrl(key);
}

async function shapePodcasts(rows: PodcastRow[], viewerId: string | null) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const hostIds = [...new Set(rows.map((r) => r.hostUserId))];

  const hosts = await db
    .select({ id: users.id, username: users.username, name: users.name, avatarUrl: users.avatarUrl, role: users.role })
    .from(users)
    .where(inArray(users.id, hostIds));
  const hostMap = new Map(hosts.map((h) => [h.id, h]));

  const epCounts = await db
    .select({ k: podcastEpisodes.podcastId, c: count() })
    .from(podcastEpisodes)
    .where(inArray(podcastEpisodes.podcastId, ids))
    .groupBy(podcastEpisodes.podcastId);
  const epMap = new Map(epCounts.map((r) => [r.k, r.c]));

  const subCounts = await db
    .select({ k: podcastSubscriptions.podcastId, c: count() })
    .from(podcastSubscriptions)
    .where(inArray(podcastSubscriptions.podcastId, ids))
    .groupBy(podcastSubscriptions.podcastId);
  const subMap = new Map(subCounts.map((r) => [r.k, r.c]));

  let mineSet = new Set<string>();
  if (viewerId) {
    const mine = await db
      .select({ podcastId: podcastSubscriptions.podcastId })
      .from(podcastSubscriptions)
      .where(and(eq(podcastSubscriptions.userId, viewerId), inArray(podcastSubscriptions.podcastId, ids)));
    mineSet = new Set(mine.map((m) => m.podcastId));
  }

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      host: hostMap.get(r.hostUserId) ?? null,
      title: r.title,
      description: r.description,
      coverUrl: await signCover(r.coverKey),
      university: r.university,
      episodeCount: epMap.get(r.id) ?? 0,
      subscriberCount: subMap.get(r.id) ?? 0,
      isSubscribed: viewerId ? mineSet.has(r.id) : null,
      createdAt: r.createdAt,
    })),
  );
}

async function shapeEpisode(r: EpisodeRow) {
  return {
    id: r.id,
    podcastId: r.podcastId,
    title: r.title,
    description: r.description,
    audioUrl: await signAudio(r.audioKey),
    durationSeconds: r.durationSeconds,
    publishedAt: r.publishedAt,
  };
}

async function loadPodcast(id: string): Promise<PodcastRow | null> {
  const [row] = await db.select().from(podcasts).where(eq(podcasts.id, id)).limit(1);
  return row ?? null;
}

/** POST /podcasts — create a series (artist only). */
router.post("/podcasts", requireAuth, requireVerified, async (req, res): Promise<void> => {
  if (req.auth?.role !== "artist") {
    res.status(403).json({ error: "Only artists can create podcasts" });
    return;
  }
  const { title, description, coverKey, university } = req.body as {
    title?: unknown;
    description?: unknown;
    coverKey?: unknown;
    university?: unknown;
  };
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [created] = await db
    .insert(podcasts)
    .values({
      hostUserId: req.userId!,
      title: title.trim(),
      description: typeof description === "string" ? description : "",
      coverKey: typeof coverKey === "string" ? coverKey : null,
      university: typeof university === "string" ? university : null,
    })
    .returning();
  const [shaped] = await shapePodcasts([created], req.userId!);
  res.status(201).json(shaped);
});

/** GET /podcasts?university= — list podcasts, newest first. */
router.get("/podcasts", optionalAuth, async (req, res): Promise<void> => {
  const university = typeof req.query.university === "string" ? req.query.university : null;
  const rows = await db
    .select()
    .from(podcasts)
    .where(university ? eq(podcasts.university, university) : undefined)
    .orderBy(desc(podcasts.createdAt))
    .limit(50);
  res.json({ items: await shapePodcasts(rows, req.userId ?? null) });
});

/** GET /podcasts/subscribed — my subscriptions. */
router.get("/podcasts/subscribed", requireAuth, async (req, res): Promise<void> => {
  const subs = await db
    .select({ podcastId: podcastSubscriptions.podcastId })
    .from(podcastSubscriptions)
    .where(eq(podcastSubscriptions.userId, req.userId!));
  const ids = subs.map((s) => s.podcastId);
  if (ids.length === 0) {
    res.json({ items: [] });
    return;
  }
  const rows = await db.select().from(podcasts).where(inArray(podcasts.id, ids)).orderBy(desc(podcasts.createdAt));
  res.json({ items: await shapePodcasts(rows, req.userId!) });
});

/** GET /podcasts/:id — one series. */
router.get("/podcasts/:id", optionalAuth, async (req, res): Promise<void> => {
  const row = await loadPodcast(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Podcast not found" });
    return;
  }
  const [shaped] = await shapePodcasts([row], req.userId ?? null);
  res.json(shaped);
});

/** DELETE /podcasts/:id — host removes the series (cascades episodes + subs). */
router.delete("/podcasts/:id", requireAuth, async (req, res): Promise<void> => {
  const row = await loadPodcast(String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Podcast not found" });
    return;
  }
  if (row.hostUserId !== req.userId) {
    res.status(403).json({ error: "Only the host can delete this podcast" });
    return;
  }
  await db.delete(podcasts).where(eq(podcasts.id, row.id));
  res.status(204).end();
});

/** GET /podcasts/:id/episodes — cursor-paginated episodes, newest first. */
router.get("/podcasts/:id/episodes", optionalAuth, async (req, res): Promise<void> => {
  const podcastId = String(req.params.id);
  const cursorRaw = req.query.cursor;
  const cursor = typeof cursorRaw === "string" ? new Date(cursorRaw) : null;
  const validCursor = cursor && !isNaN(cursor.getTime()) ? cursor : null;

  const rows = await db
    .select()
    .from(podcastEpisodes)
    .where(
      validCursor
        ? and(eq(podcastEpisodes.podcastId, podcastId), lt(podcastEpisodes.publishedAt, validCursor))
        : eq(podcastEpisodes.podcastId, podcastId),
    )
    .orderBy(desc(podcastEpisodes.publishedAt))
    .limit(31);

  const hasMore = rows.length > 30;
  const page = hasMore ? rows.slice(0, 30) : rows;
  res.json({
    items: await Promise.all(page.map(shapeEpisode)),
    nextCursor: hasMore ? page[page.length - 1].publishedAt.toISOString() : null,
  });
});

/** POST /podcasts/:id/episodes — publish an episode (host only). */
router.post("/podcasts/:id/episodes", requireAuth, requireVerified, async (req, res): Promise<void> => {
  const podcast = await loadPodcast(String(req.params.id));
  if (!podcast) {
    res.status(404).json({ error: "Podcast not found" });
    return;
  }
  if (podcast.hostUserId !== req.userId) {
    res.status(403).json({ error: "Only the host can publish episodes" });
    return;
  }
  const { title, description, audioKey, durationSeconds } = req.body as {
    title?: unknown;
    description?: unknown;
    audioKey?: unknown;
    durationSeconds?: unknown;
  };
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof audioKey !== "string" || !audioKey) {
    res.status(400).json({ error: "audioKey is required" });
    return;
  }
  const [created] = await db
    .insert(podcastEpisodes)
    .values({
      podcastId: podcast.id,
      title: title.trim(),
      description: typeof description === "string" ? description : "",
      audioKey,
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : null,
    })
    .returning();

  // Notify subscribers.
  const subs = await db
    .select({ userId: podcastSubscriptions.userId })
    .from(podcastSubscriptions)
    .where(eq(podcastSubscriptions.podcastId, podcast.id));
  await notifyMany(
    subs.map((s) => s.userId),
    {
      type: "new_episode",
      actorUserId: podcast.hostUserId,
      targetType: "podcast",
      targetId: podcast.id,
      body: `${podcast.title}: ${created.title}`,
      pushTitle: "New episode",
    },
  );

  res.status(201).json(await shapeEpisode(created));
});

/** POST /podcasts/:id/subscribe — toggle subscription. */
router.post("/podcasts/:id/subscribe", requireAuth, async (req, res): Promise<void> => {
  const podcastId = String(req.params.id);
  const podcast = await loadPodcast(podcastId);
  if (!podcast) {
    res.status(404).json({ error: "Podcast not found" });
    return;
  }
  const [existing] = await db
    .select({ userId: podcastSubscriptions.userId })
    .from(podcastSubscriptions)
    .where(and(eq(podcastSubscriptions.podcastId, podcastId), eq(podcastSubscriptions.userId, req.userId!)))
    .limit(1);

  let subscribed: boolean;
  if (existing) {
    await db
      .delete(podcastSubscriptions)
      .where(and(eq(podcastSubscriptions.podcastId, podcastId), eq(podcastSubscriptions.userId, req.userId!)));
    subscribed = false;
  } else {
    await db.insert(podcastSubscriptions).values({ podcastId, userId: req.userId! }).onConflictDoNothing();
    subscribed = true;
  }
  const [{ c }] = await db
    .select({ c: count() })
    .from(podcastSubscriptions)
    .where(eq(podcastSubscriptions.podcastId, podcastId));
  res.json({ subscribed, subscriberCount: c });
});

export default router;
