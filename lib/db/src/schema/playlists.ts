import { sql } from "drizzle-orm";
import { boolean, index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

// A user-curated playlist. The auto "Liked Songs" list is virtual (wraps
// user_likes) and is NOT stored here.
export const playlists = campusMusic.table(
  "playlists",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    coverColor: text("cover_color"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("playlists_owner_idx").on(t.ownerUserId), index("playlists_created_idx").on(t.createdAt.desc())],
);

export type Playlist = typeof playlists.$inferSelect;
