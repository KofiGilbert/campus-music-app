import { pgTable, text, primaryKey, timestamp } from "drizzle-orm/pg-core";

export const artistFollows = pgTable("artist_follows", {
  userId: text("user_id").notNull(),
  artistId: text("artist_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.artistId] })]);

export type ArtistFollow = typeof artistFollows.$inferSelect;
