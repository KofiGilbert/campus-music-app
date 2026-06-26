import { sql } from "drizzle-orm";
import { timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";
import { posts } from "./posts";

export const postLikes = campusMusic.table(
  "post_likes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: varchar("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("post_likes_post_user_idx").on(t.postId, t.userId)],
);

export type PostLike = typeof postLikes.$inferSelect;
