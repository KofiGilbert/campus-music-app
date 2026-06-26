import { text, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";
import { tracks } from "./tracks";

export const userLikes = campusMusic.table(
  "user_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.trackId] })],
);

// NOTE: user_library is intentionally left without FKs/timestamps here — it was
// not in the Phase 0 schema-hygiene scope (Devin's Decision D listed likes, not
// library). Mirror the user_likes treatment in a follow-up if desired.
export const userLibrary = campusMusic.table(
  "user_library",
  {
    userId: text("user_id").notNull(),
    trackId: text("track_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.trackId] })],
);
