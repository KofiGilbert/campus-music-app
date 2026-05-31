import { text, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";

export const artistFollows = campusMusic.table("artist_follows", {
  userId: text("user_id").notNull(),
  artistId: text("artist_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.artistId] })]);

export type ArtistFollow = typeof artistFollows.$inferSelect;
