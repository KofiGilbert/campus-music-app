import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, lt, notInArray, or } from "drizzle-orm";
import { db, posts, artistFollows, userConnections } from "@workspace/db";
import { optionalAuth } from "../middlewares/auth";
import { shapePosts } from "../lib/postShape";

const router: IRouter = Router();

type PostRow = typeof posts.$inferSelect;

function parseLimit(value: unknown): number {
  const n = typeof value === "string" ? parseInt(value, 10) : NaN;
  if (isNaN(n) || n <= 0) return 20;
  return Math.min(n, 50);
}
function parseCursor(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Authors whose posts make up a user's feed: followed artists + accepted
 * connections + self. */
async function getFeedAuthorIds(userId: string): Promise<string[]> {
  const [follows, conns] = await Promise.all([
    db.select({ id: artistFollows.artistId }).from(artistFollows).where(eq(artistFollows.userId, userId)),
    db
      .select({ from: userConnections.fromUserId, to: userConnections.toUserId })
      .from(userConnections)
      .where(
        and(
          eq(userConnections.status, "accepted"),
          or(eq(userConnections.fromUserId, userId), eq(userConnections.toUserId, userId)),
        ),
      ),
  ]);
  const ids = new Set<string>([userId]);
  for (const f of follows) ids.add(f.id);
  for (const c of conns) ids.add(c.from === userId ? c.to : c.from);
  return [...ids];
}

/**
 * GET /feed — cursor-paginated post feed. Personalized to followed artists +
 * connections + self; backfilled with recent global posts when a new user's
 * personalized first page is sparse. Unauthenticated users get recent global
 * posts. Returns { items, nextCursor }.
 */
router.get("/feed", optionalAuth, async (req, res): Promise<void> => {
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);
  const viewer = req.userId ?? null;
  const authorIds = viewer ? await getFeedAuthorIds(viewer) : [];

  let rows: PostRow[];
  let nextCursor: string | null;

  if (!viewer || authorIds.length === 0) {
    const global = await db
      .select()
      .from(posts)
      .where(and(isNull(posts.deletedAt), cursor ? lt(posts.createdAt, cursor) : undefined))
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1);
    const hasMore = global.length > limit;
    rows = hasMore ? global.slice(0, limit) : global;
    nextCursor = hasMore ? rows[rows.length - 1].createdAt.toISOString() : null;
  } else {
    const personalized = await db
      .select()
      .from(posts)
      .where(
        and(
          inArray(posts.authorUserId, authorIds),
          isNull(posts.deletedAt),
          cursor ? lt(posts.createdAt, cursor) : undefined,
        ),
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1);
    const hasMore = personalized.length > limit;
    const page = hasMore ? personalized.slice(0, limit) : personalized;

    if (!cursor && page.length < limit) {
      // Sparse first page — backfill with recent global posts (single page).
      const need = limit - page.length;
      const backfill = await db
        .select()
        .from(posts)
        .where(and(isNull(posts.deletedAt), notInArray(posts.authorUserId, authorIds)))
        .orderBy(desc(posts.createdAt))
        .limit(need);
      rows = [...page, ...backfill].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      nextCursor = null;
    } else {
      rows = page;
      nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;
    }
  }

  const items = await shapePosts(rows, viewer);
  res.json({ items, nextCursor });
});

export default router;
