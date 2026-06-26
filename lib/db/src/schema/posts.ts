import { sql } from "drizzle-orm";
import { type AnyPgColumn, index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";
import { tracks } from "./tracks";

// Social posts. A post may attach a track and/or image. Reposts and quotes are
// posts with type 'repost'/'quote' pointing at originalPostId (so they appear
// naturally in the feed). Soft-deleted via deletedAt.
export const posts = campusMusic.table(
  "posts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    authorUserId: varchar("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    attachedTrackId: varchar("attached_track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    attachedImageUrl: text("attached_image_url"),
    type: text("type").notNull().default("original"), // original | repost | quote
    originalPostId: varchar("original_post_id").references((): AnyPgColumn => posts.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("posts_author_created_idx").on(t.authorUserId, t.createdAt.desc()),
    index("posts_created_idx").on(t.createdAt.desc()),
    index("posts_attached_track_idx").on(t.attachedTrackId),
    index("posts_original_post_idx").on(t.originalPostId),
  ],
);

export type Post = typeof posts.$inferSelect;
