import { sql } from "drizzle-orm";
import { index, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { playlists } from "./playlists";
import { tracks } from "./tracks";

// Membership of a track in a playlist. `position` defines order (0-based, dense).
// Duplicates are allowed (Spotify-style), so this has its own surrogate id rather
// than a (playlist, track) composite PK.
export const playlistTracks = campusMusic.table(
  "playlist_tracks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    playlistId: varchar("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    trackId: varchar("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("playlist_tracks_playlist_position_idx").on(t.playlistId, t.position),
    index("playlist_tracks_track_idx").on(t.trackId),
  ],
);

export type PlaylistTrack = typeof playlistTracks.$inferSelect;
