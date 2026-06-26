import { text, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

export const artistFollows = campusMusic.table(
  "artist_follows",
  {
    // follower
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // the followed artist (also a users row, role='artist')
    artistId: text("artist_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.artistId] })],
);

export type ArtistFollow = typeof artistFollows.$inferSelect;
