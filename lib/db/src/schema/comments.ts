import { sql } from "drizzle-orm";
import { type AnyPgColumn, index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

// Polymorphic comments on posts OR tracks (targetType + targetId, validated in
// app code — no DB FK). One level of nesting: a reply sets parentCommentId.
export const comments = campusMusic.table(
  "comments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    targetType: text("target_type").notNull(), // post | track
    targetId: varchar("target_id").notNull(),
    authorUserId: varchar("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    parentCommentId: varchar("parent_comment_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("comments_target_idx").on(t.targetType, t.targetId, t.createdAt),
    index("comments_author_idx").on(t.authorUserId),
    index("comments_parent_idx").on(t.parentCommentId),
  ],
);

export type Comment = typeof comments.$inferSelect;
