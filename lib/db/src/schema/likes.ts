import { text, primaryKey } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";

export const userLikes = campusMusic.table("user_likes", {
  userId: text("user_id").notNull(),
  trackId: text("track_id").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.trackId] })]);

export const userLibrary = campusMusic.table("user_library", {
  userId: text("user_id").notNull(),
  trackId: text("track_id").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.trackId] })]);
