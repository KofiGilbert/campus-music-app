import { sql } from "drizzle-orm";
import { index, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";
import { tracks } from "./tracks";

// A live audio broadcast. `transport` is designed-in from day one so a runaway
// room can switch from LiveKit (interactive) to Cloudflare Stream (HLS) behind a
// flag without a schema change (DEVIN_ROADMAP §3.6). `recordingTrackId` links to
// the tracks row auto-published when the session ends (the "Spotify can't do
// this" feature).
export const liveSessions = campusMusic.table(
  "live_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    hostUserId: varchar("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    status: text("status").notNull().default("live"), // live | ended
    transport: text("transport").notNull().default("livekit"), // livekit | cloudflare_stream
    roomName: text("room_name").notNull(),
    listenerCount: integer("listener_count").notNull().default(0),
    peakListenerCount: integer("peak_listener_count").notNull().default(0),
    recordingTrackId: varchar("recording_track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("live_sessions_status_started_idx").on(t.status, t.startedAt.desc()),
    index("live_sessions_host_idx").on(t.hostUserId),
  ],
);

export type LiveSession = typeof liveSessions.$inferSelect;
