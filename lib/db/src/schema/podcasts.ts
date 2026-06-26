import { sql } from "drizzle-orm";
import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

// A podcast series. Any artist can host one (no new role — DEVIN_ROADMAP §3).
// `coverKey` holds an image storage key (signed at read time) or a passthrough
// http(s) URL.
export const podcasts = campusMusic.table(
  "podcasts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    hostUserId: varchar("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    coverKey: text("cover_key"),
    university: text("university"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("podcasts_host_idx").on(t.hostUserId),
    index("podcasts_university_idx").on(t.university),
    index("podcasts_created_idx").on(t.createdAt.desc()),
  ],
);

export type Podcast = typeof podcasts.$inferSelect;
