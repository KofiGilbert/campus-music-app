import { sql } from "drizzle-orm";
import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";
import { posts } from "./posts";

// Shares — no UNIQUE constraint: a user can share a post repeatedly (different
// platforms / re-shares). platform: internal | copy_link | twitter | ...
export const postShares = campusMusic.table(
  "post_shares",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: varchar("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull().default("internal"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("post_shares_post_created_idx").on(t.postId, t.createdAt.desc())],
);

export type PostShare = typeof postShares.$inferSelect;
