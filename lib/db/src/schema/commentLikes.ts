import { sql } from "drizzle-orm";
import { timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";
import { comments } from "./comments";

export const commentLikes = campusMusic.table(
  "comment_likes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    commentId: varchar("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("comment_likes_comment_user_idx").on(t.commentId, t.userId)],
);

export type CommentLike = typeof commentLikes.$inferSelect;
