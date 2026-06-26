import { Router, type IRouter, type Request, type Response } from "express";
import { and, count, desc, eq, isNull, lt } from "drizzle-orm";
import { db, comments, posts, tracks, commentLikes } from "@workspace/db";
import { optionalAuth, requireAuth, requireVerified } from "../middlewares/auth";
import { shapeComment, shapeComments } from "../lib/commentShape";

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

async function targetExists(targetType: string, targetId: string): Promise<boolean> {
  if (targetType === "post") {
    const [p] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, targetId), isNull(posts.deletedAt)))
      .limit(1);
    return !!p;
  }
  if (targetType === "track") {
    const [t] = await db.select({ id: tracks.id }).from(tracks).where(eq(tracks.id, targetId)).limit(1);
    return !!t;
  }
  return false;
}

/** POST /comments — comment on a post or track, or reply (one level). */
router.post("/comments", requireAuth, requireVerified, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const { targetType, targetId, body, parentCommentId } = req.body as {
    targetType?: unknown;
    targetId?: unknown;
    body?: unknown;
    parentCommentId?: unknown;
  };

  if (typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "Comment body is required" });
    return;
  }

  let resolvedType: string;
  let resolvedId: string;

  if (typeof parentCommentId === "string" && parentCommentId) {
    // Reply: inherit the target from the parent, enforce one level of nesting.
    const [parent] = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, parentCommentId), isNull(comments.deletedAt)))
      .limit(1);
    if (!parent) {
      res.status(404).json({ error: "Parent comment not found" });
      return;
    }
    if (parent.parentCommentId) {
      res.status(400).json({ error: "Replies cannot be nested more than one level" });
      return;
    }
    resolvedType = parent.targetType;
    resolvedId = parent.targetId;
  } else {
    if (
      (targetType !== "post" && targetType !== "track") ||
      typeof targetId !== "string" ||
      !targetId
    ) {
      res.status(400).json({ error: "targetType (post|track) and targetId are required" });
      return;
    }
    if (!(await targetExists(targetType, targetId))) {
      res.status(404).json({ error: "Comment target not found" });
      return;
    }
    resolvedType = targetType;
    resolvedId = targetId;
  }

  const [comment] = await db
    .insert(comments)
    .values({
      targetType: resolvedType,
      targetId: resolvedId,
      authorUserId: userId,
      body: body.trim(),
      parentCommentId: typeof parentCommentId === "string" && parentCommentId ? parentCommentId : null,
    })
    .returning();

  res.status(201).json(await shapeComment(comment, userId));
});

/** GET /comments?targetType=&targetId= — top-level comments with eager replies. */
router.get("/comments", optionalAuth, async (req, res): Promise<void> => {
  const { targetType, targetId } = req.query as { targetType?: string; targetId?: string };
  if ((targetType !== "post" && targetType !== "track") || !targetId) {
    res.status(400).json({ error: "targetType (post|track) and targetId are required" });
    return;
  }
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const rows = await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
        isNull(comments.parentCommentId),
        isNull(comments.deletedAt),
        cursor ? lt(comments.createdAt, cursor) : undefined,
      ),
    )
    .orderBy(desc(comments.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = await shapeComments(page, req.userId ?? null, { withReplies: true });
  res.json({ items, nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null });
});

/** POST /comments/:id/like — toggle a comment like. Returns { liked, likeCount }. */
router.post(
  "/comments/:id/like",
  requireAuth,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const userId = req.userId!;
    const commentId = req.params.id;
    const [comment] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
      .limit(1);
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    const [existing] = await db
      .select({ id: commentLikes.id })
      .from(commentLikes)
      .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
      .limit(1);

    let liked: boolean;
    if (existing) {
      await db.delete(commentLikes).where(eq(commentLikes.id, existing.id));
      liked = false;
    } else {
      await db.insert(commentLikes).values({ commentId, userId }).onConflictDoNothing();
      liked = true;
    }

    const [{ c }] = await db
      .select({ c: count() })
      .from(commentLikes)
      .where(eq(commentLikes.commentId, commentId));
    res.json({ liked, likeCount: c });
  },
);

/** DELETE /comments/:id — soft delete, ownership-checked. */
router.delete(
  "/comments/:id",
  requireAuth,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const [comment] = await db.select().from(comments).where(eq(comments.id, req.params.id)).limit(1);
    if (!comment || comment.deletedAt) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    if (comment.authorUserId !== req.userId) {
      res.status(403).json({ error: "You can only delete your own comments" });
      return;
    }
    await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, comment.id));
    res.status(204).send();
  },
);

export default router;
