import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { db, comments, users, commentLikes } from "@workspace/db";

type CommentRow = typeof comments.$inferSelect;
const MAX_EAGER_REPLIES = 3;

export interface ShapedComment {
  id: string;
  author: { id: string; username: string; name: string; avatarUrl: string | null } | null;
  body: string;
  parentCommentId: string | null;
  replyCount: number;
  likeCount: number;
  hasLiked: boolean | null;
  replies: ShapedComment[];
  createdAt: Date;
}

/**
 * Shape comment rows: author, like count + viewer's hasLiked, and (for
 * top-level comments, withReplies) up to 3 eager replies + the total replyCount.
 * All lookups batched.
 */
export async function shapeComments(
  rows: CommentRow[],
  viewerUserId: string | null,
  opts: { withReplies?: boolean } = {},
): Promise<ShapedComment[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.authorUserId))];

  const authorRows = await db
    .select({ id: users.id, username: users.username, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, authorIds));
  const authorMap = new Map(authorRows.map((a) => [a.id, a]));

  const likeRows = await db
    .select({ k: commentLikes.commentId, c: count() })
    .from(commentLikes)
    .where(inArray(commentLikes.commentId, ids))
    .groupBy(commentLikes.commentId);
  const likeMap = new Map(likeRows.map((r) => [r.k, r.c]));

  let likedSet = new Set<string>();
  if (viewerUserId) {
    const liked = await db
      .select({ commentId: commentLikes.commentId })
      .from(commentLikes)
      .where(and(eq(commentLikes.userId, viewerUserId), inArray(commentLikes.commentId, ids)));
    likedSet = new Set(liked.map((l) => l.commentId));
  }

  const repliesByParent = new Map<string, CommentRow[]>();
  const replyCountByParent = new Map<string, number>();
  const shapedReplyMap = new Map<string, ShapedComment>();
  if (opts.withReplies) {
    const replyRows = await db
      .select()
      .from(comments)
      .where(and(inArray(comments.parentCommentId, ids), isNull(comments.deletedAt)))
      .orderBy(asc(comments.createdAt));
    for (const r of replyRows) {
      const p = r.parentCommentId!;
      replyCountByParent.set(p, (replyCountByParent.get(p) ?? 0) + 1);
      const arr = repliesByParent.get(p) ?? [];
      if (arr.length < MAX_EAGER_REPLIES) arr.push(r);
      repliesByParent.set(p, arr);
    }
    const eager = [...repliesByParent.values()].flat();
    const shaped = await shapeComments(eager, viewerUserId, { withReplies: false });
    for (const c of shaped) shapedReplyMap.set(c.id, c);
  }

  return rows.map((r) => ({
    id: r.id,
    author: authorMap.get(r.authorUserId) ?? null,
    body: r.body,
    parentCommentId: r.parentCommentId,
    replyCount: replyCountByParent.get(r.id) ?? 0,
    likeCount: likeMap.get(r.id) ?? 0,
    hasLiked: viewerUserId ? likedSet.has(r.id) : null,
    replies: (repliesByParent.get(r.id) ?? [])
      .map((rep) => shapedReplyMap.get(rep.id))
      .filter((x): x is ShapedComment => !!x),
    createdAt: r.createdAt,
  }));
}

export async function shapeComment(row: CommentRow, viewerUserId: string | null): Promise<ShapedComment> {
  const [shaped] = await shapeComments([row], viewerUserId, { withReplies: true });
  return shaped;
}
