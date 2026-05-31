import { real, text, timestamp } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";

export const userPlayback = campusMusic.table("user_playback", {
  userId: text("user_id").primaryKey().notNull(),
  trackId: text("track_id").notNull(),
  position: real("position").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserPlayback = typeof userPlayback.$inferSelect;
