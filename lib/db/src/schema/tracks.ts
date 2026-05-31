import { sql } from "drizzle-orm";
import { integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tracks = pgTable("tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  artistId: text("artist_id").notNull(),
  genre: text("genre").notNull(),
  duration: text("duration").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  coverColor: text("cover_color").notNull(),
  audioUrl: text("audio_url"),
  coverUrl: text("cover_url"),
  playCount: integer("play_count").notNull().default(0),
  university: text("university").notNull().default(""),
});

export const insertTrackSchema = createInsertSchema(tracks).omit({});
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracks.$inferSelect;
