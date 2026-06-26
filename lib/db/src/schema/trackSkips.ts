import { sql } from "drizzle-orm";
import { index, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";
import { tracks } from "./tracks";

// Skip telemetry — feeds recommendation/quality signals later.
export const trackSkips = campusMusic.table(
  "track_skips",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: varchar("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    skippedAt: timestamp("skipped_at", { withTimezone: true }).notNull().defaultNow(),
    secondsBeforeSkip: integer("seconds_before_skip").notNull(),
  },
  (t) => [index("track_skips_user_track_idx").on(t.userId, t.trackId)],
);

export type TrackSkip = typeof trackSkips.$inferSelect;
