import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const artists = pgTable("artists", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  genre: text("genre").notNull(),
  university: text("university").notNull().default(""),
  coverColor: text("cover_color").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio").notNull().default(""),
});

export const insertArtistSchema = createInsertSchema(artists).omit({});
export type InsertArtist = z.infer<typeof insertArtistSchema>;
export type Artist = typeof artists.$inferSelect;
