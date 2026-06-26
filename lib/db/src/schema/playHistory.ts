import { sql } from "drizzle-orm";
import { boolean, index, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";
import { tracks } from "./tracks";

// Per-listen telemetry. One row per play (for authenticated users); powers the
// listening-history feed and the rolling-window trending query.
export const playHistory = campusMusic.table(
  "play_history",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: varchar("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
    secondsListened: integer("seconds_listened").notNull(),
    completed: boolean("completed").notNull().default(false), // >=90% of the track
    // feed | search | playlist | live_recording | recommendation | library |
    // profile | trending | discover
    source: text("source").notNull(),
    context: text("context"), // playlist/artist/feed-position the play originated from
  },
  (t) => [
    index("play_history_user_played_idx").on(t.userId, t.playedAt.desc()),
    index("play_history_track_played_idx").on(t.trackId, t.playedAt),
    index("play_history_played_idx").on(t.playedAt),
  ],
);

export type PlayHistory = typeof playHistory.$inferSelect;
