import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db, posts, users, tracks, postLikes, postShares, comments } from "@workspace/db";
import { signTrackMedia } from "./trackMedia";

type PostRow = typeof posts.$inferSelect;

export interface ShapedPost {
  id: string;
  author: { id: string; username: string; name: string; avatarUrl: string | null; role: string } | null;
  body: string;
  type: string;
  attachedTrack: Awaited<ReturnType<typeof signTrackMedia>> | null;
  attachedImageUrl: string | null;
  originalPost: ShapedPost | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  repostCount: number;
  hasLiked: boolean | null;
  hasReposted: boolean | null;
  createdAt: Date;
}

/**
 * Shape a batch of post rows into the API response form: author, attached track
 * (signed), engagement counts, embedded original (for reposts/quotes), and the
 * viewer's hasLiked/hasReposted. All lookups are batched (no N+1). Pass
 * embedOriginals:false to stop the one-level recursion when shaping originals.
 */
export async function shapePosts(
  rows: PostRow[],
  viewerUserId: string | null,
  opts: { embedOriginals?: boolean } = {},
): Promise<ShapedPost[]> {
  if (rows.length === 0) return [];
  const embedOriginals = opts.embedOriginals !== false;

  const postIds = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.authorUserId))];
  const trackIds = [...new Set(rows.map((r) => r.attachedTrackId).filter((x): x is string => !!x))];
  const originalIds = [...new Set(rows.map((r) => r.originalPostId).filter((x): x is string => !!x))];

  const authorRows = await db
    .select({ id: users.id, username: users.username, name: users.name, avatarUrl: users.avatarUrl, role: users.role })
    .from(users)
    .where(inArray(users.id, authorIds));
  const authorMap = new Map(authorRows.map((a) => [a.id, a]));

  const trackMap = new Map<string, ShapedPost["attachedTrack"]>();
  if (trackIds.length) {
    const trackRows = await db.select().from(tracks).where(inArray(tracks.id, trackIds));
    const signed = await Promise.all(trackRows.map((t) => signTrackMedia(t)));
    for (const t of signed) trackMap.set(t.id, t);
  }

  const likeRows = await db
    .select({ k: postLikes.postId, c: count() })
    .from(postLikes)
    .where(inArray(postLikes.postId, postIds))
    .groupBy(postLikes.postId);
  const likeMap = new Map(likeRows.map((r) => [r.k, r.c]));

  const shareRows = await db
    .select({ k: postShares.postId, c: count() })
    .from(postShares)
    .where(inArray(postShares.postId, postIds))
    .groupBy(postShares.postId);
  const shareMap = new Map(shareRows.map((r) => [r.k, r.c]));

  const commentRows = await db
    .select({ k: comments.targetId, c: count() })
    .from(comments)
    .where(and(eq(comments.targetType, "post"), inArray(comments.targetId, postIds), isNull(comments.deletedAt)))
    .groupBy(comments.targetId);
  const commentMap = new Map(commentRows.map((r) => [r.k, r.c]));

  const repostRows = await db
    .select({ k: posts.originalPostId, c: count() })
    .from(posts)
    .where(and(eq(posts.type, "repost"), inArray(posts.originalPostId, postIds), isNull(posts.deletedAt)))
    .groupBy(posts.originalPostId);
  const repostMap = new Map(repostRows.filter((r) => r.k).map((r) => [r.k!, r.c]));

  let likedSet = new Set<string>();
  let repostedSet = new Set<string>();
  if (viewerUserId) {
    const liked = await db
      .select({ postId: postLikes.postId })
      .from(postLikes)
      .where(and(eq(postLikes.userId, viewerUserId), inArray(postLikes.postId, postIds)));
    likedSet = new Set(liked.map((l) => l.postId));
    const reposted = await db
      .select({ originalPostId: posts.originalPostId })
      .from(posts)
      .where(
        and(
          eq(posts.type, "repost"),
          eq(posts.authorUserId, viewerUserId),
          inArray(posts.originalPostId, postIds),
          isNull(posts.deletedAt),
        ),
      );
    repostedSet = new Set(reposted.map((r) => r.originalPostId).filter((x): x is string => !!x));
  }

  const originalMap = new Map<string, ShapedPost>();
  if (embedOriginals && originalIds.length) {
    const originalRows = await db.select().from(posts).where(inArray(posts.id, originalIds));
    const shaped = await shapePosts(originalRows, viewerUserId, { embedOriginals: false });
    for (const p of shaped) originalMap.set(p.id, p);
  }

  return rows.map((r) => ({
    id: r.id,
    author: authorMap.get(r.authorUserId) ?? null,
    body: r.body,
    type: r.type,
    attachedTrack: r.attachedTrackId ? (trackMap.get(r.attachedTrackId) ?? null) : null,
    attachedImageUrl: r.attachedImageUrl,
    originalPost: r.originalPostId ? (originalMap.get(r.originalPostId) ?? null) : null,
    likeCount: likeMap.get(r.id) ?? 0,
    commentCount: commentMap.get(r.id) ?? 0,
    shareCount: shareMap.get(r.id) ?? 0,
    repostCount: repostMap.get(r.id) ?? 0,
    hasLiked: viewerUserId ? likedSet.has(r.id) : null,
    hasReposted: viewerUserId ? repostedSet.has(r.id) : null,
    createdAt: r.createdAt,
  }));
}

export async function shapePost(row: PostRow, viewerUserId: string | null): Promise<ShapedPost> {
  const [shaped] = await shapePosts([row], viewerUserId);
  return shaped;
}
