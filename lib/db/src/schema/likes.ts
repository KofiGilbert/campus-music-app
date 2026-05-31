import { pgTable, text, primaryKey } from "drizzle-orm/pg-core";

export const userLikes = pgTable("user_likes", {
  userId: text("user_id").notNull(),
  trackId: text("track_id").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.trackId] })]);

export const userLibrary = pgTable("user_library", {
  userId: text("user_id").notNull(),
  trackId: text("track_id").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.trackId] })]);
