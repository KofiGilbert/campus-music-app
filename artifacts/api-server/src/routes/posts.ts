import { Router, type IRouter, type Request, type Response } from "express";
import { and, count, desc, eq, isNull, lt } from "drizzle-orm";
import { db, posts, tracks, postLikes, postShares } from "@workspace/db";
import { optionalAuth, requireAuth, requireVerified } from "../middlewares/auth";
import { shapePost, shapePosts } from "../lib/postShape";
import { extractMentions, extractHashtags } from "../lib/mentions";
import { notify } from "../lib/notify";

const router: IRouter = Router();

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

/** POST /posts — create an original / quote / (repost) post. */
router.post("/posts", requireAuth, requireVerified, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const { body, attachedTrackId, attachedImageUrl, type, originalPostId } = req.body as {
    body?: unknown;
    attachedTrackId?: unknown;
    attachedImageUrl?: unknown;
    type?: unknown;
    originalPostId?: unknown;
  };

  const postType = type === "repost" || type === "quote" ? type : "original";
  const bodyText = typeof body === "string" ? body : "";
  const trackId = typeof attachedTrackId === "string" ? attachedTrackId : null;
  const imageUrl = typeof attachedImageUrl === "string" ? attachedImageUrl : null;
  const origId = typeof originalPostId === "string" ? originalPostId : null;

  if (postType === "quote" && (!bodyText.trim() || !origId)) {
    res.status(400).json({ error: "A quote requires a body and originalPostId" });
    return;
  }
  if (postType === "repost" && !origId) {
    res.status(400).json({ error: "A repost requires originalPostId" });
    return;
  }
  if (postType === "original" && !bodyText.trim() && !trackId && !imageUrl) {
    res.status(400).json({ error: "A post needs a body, a track, or an image" });
    return;
  }

  if (trackId) {
    const [t] = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, trackId)).limit(1);
    if (!t) {
      res.status(400).json({ error: "attachedTrackId does not exist" });
      return;
    }
  }
  if (origId) {
    const [p] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, origId), isNull(posts.deletedAt)))
      .limit(1);
    if (!p) {
      res.status(404).json({ error: "originalPostId does not exist" });
      return;
    }
  }

  const [post] = await db
    .insert(posts)
    .values({
      authorUserId: userId,
      body: bodyText,
      attachedTrackId: trackId,
      attachedImageUrl: imageUrl,
      type: postType,
      originalPostId: origId,
    })
    .returning();

  req.log.info(
    {
      postId: post.id,
      userId,
      type: postType,
      mentions: extractMentions(bodyText),
      hashtags: extractHashtags(bodyText),
    },
    "Post created",
  );
  res.status(201).json(await shapePost(post, userId));
});

/** GET /posts/:id — single post. */
router.get(
  "/posts/:id",
  optionalAuth,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const [post] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, req.params.id), isNull(posts.deletedAt)))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json(await shapePost(post, req.userId ?? null));
  },
);

/** DELETE /posts/:id — soft delete, ownership-checked. */
router.delete(
  "/posts/:id",
  requireAuth,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const [post] = await db.select().from(posts).where(eq(posts.id, req.params.id)).limit(1);
    if (!post || post.deletedAt) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    if (post.authorUserId !== req.userId) {
      res.status(403).json({ error: "You can only delete your own posts" });
      return;
    }
    await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, post.id));
    res.status(204).send();
  },
);

/** POST /posts/:id/like — toggle a like. Returns { liked, likeCount }. */
router.post(
  "/posts/:id/like",
  requireAuth,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.userId!;
    const postId = req.params.id;
    const [post] = await db
      .select({ id: posts.id, authorUserId: posts.authorUserId })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const [existing] = await db
      .select({ id: postLikes.id })
      .from(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
      .limit(1);

    let liked: boolean;
    if (existing) {
      await db.delete(postLikes).where(eq(postLikes.id, existing.id));
      liked = false;
    } else {
      await db.insert(postLikes).values({ postId, userId }).onConflictDoNothing();
      liked = true;
      await notify({
        userId: post.authorUserId,
        type: "post_like",
        actorUserId: userId,
        targetType: "post",
        targetId: postId,
      });
    }

    const [{ c }] = await db.select({ c: count() }).from(postLikes).where(eq(postLikes.postId, postId));
    res.json({ liked, likeCount: c });
  },
);

/** POST /posts/:id/share — record a share. Returns { shareCount, deepLink }. */
router.post(
  "/posts/:id/share",
  requireAuth,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.userId!;
    const postId = req.params.id;
    const [post] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const { platform } = req.body as { platform?: unknown };
    const plat = typeof platform === "string" && platform ? platform : "internal";
    await db.insert(postShares).values({ postId, userId, platform: plat });
    const [{ c }] = await db
      .select({ c: count() })
      .from(postShares)
      .where(eq(postShares.postId, postId));
    res.json({ shareCount: c, deepLink: `/post/${postId}` });
  },
);

/** POST /posts/:id/repost — create a repost of a post. 409 if already reposted. */
router.post(
  "/posts/:id/repost",
  requireAuth,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.userId!;
    const originalPostId = req.params.id;
    const [orig] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, originalPostId), isNull(posts.deletedAt)))
      .limit(1);
    if (!orig) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const [existing] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.type, "repost"),
          eq(posts.authorUserId, userId),
          eq(posts.originalPostId, originalPostId),
          isNull(posts.deletedAt),
        ),
      )
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "Already reposted" });
      return;
    }
    const [repost] = await db
      .insert(posts)
      .values({ authorUserId: userId, body: "", type: "repost", originalPostId })
      .returning();
    res.status(201).json(await shapePost(repost, userId));
  },
);

/** DELETE /posts/:id/unrepost — soft-delete the viewer's repost of a post. */
router.delete(
  "/posts/:id/unrepost",
  requireAuth,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.userId!;
    const originalPostId = req.params.id;
    const [existing] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.type, "repost"),
          eq(posts.authorUserId, userId),
          eq(posts.originalPostId, originalPostId),
          isNull(posts.deletedAt),
        ),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Repost not found" });
      return;
    }
    await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, existing.id));
    res.status(204).send();
  },
);

/** GET /users/:id/posts — cursor-paginated posts by a user. */
router.get(
  "/users/:id/posts",
  optionalAuth,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);

    const rows = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.authorUserId, req.params.id),
          isNull(posts.deletedAt),
          cursor ? lt(posts.createdAt, cursor) : undefined,
        ),
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = await shapePosts(page, req.userId ?? null);
    res.json({ items, nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null });
  },
);

export default router;
