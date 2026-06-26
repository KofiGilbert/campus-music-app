import { sql } from "drizzle-orm";
import { index, integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campusMusic } from "./namespace";
import { users } from "./schema";

export const tracks = campusMusic.table(
  "tracks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    artistId: text("artist_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    genre: text("genre").notNull(),
    duration: text("duration").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    coverColor: text("cover_color").notNull(),
    // audioUrl/coverUrl hold a single key (backward compat: 160k audio / medium
    // cover after transcoding). The JSON maps hold all variants by label.
    audioUrl: text("audio_url"),
    coverUrl: text("cover_url"),
    audioUrls: jsonb("audio_urls").$type<Record<string, string>>(), // { "96","160","320" }
    coverUrls: jsonb("cover_urls").$type<Record<string, string>>(), // { thumb, medium, full }
    stemUrls: jsonb("stem_urls").$type<Record<string, string>>(), // populated by the AI worker
    // pending | processing | ready | failed. Default 'ready' so pre-existing rows
    // (created before transcoding) stay playable.
    processingStatus: text("processing_status").notNull().default("ready"),
    playCount: integer("play_count").notNull().default(0),
    university: text("university").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tracks_artist_id_idx").on(t.artistId), // "tracks by this artist"
    index("tracks_created_at_idx").on(t.createdAt.desc()), // "newest tracks"
  ],
);

export const insertTrackSchema = createInsertSchema(tracks).omit({});
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracks.$inferSelect;
