import { index, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { podcasts } from "./podcasts";
import { users } from "./schema";

// A user's subscription to a podcast series. Drives new-episode notifications and
// the "Subscribed" rail.
export const podcastSubscriptions = campusMusic.table(
  "podcast_subscriptions",
  {
    podcastId: varchar("podcast_id")
      .notNull()
      .references(() => podcasts.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.podcastId, t.userId] }),
    index("podcast_subscriptions_user_idx").on(t.userId),
  ],
);

export type PodcastSubscription = typeof podcastSubscriptions.$inferSelect;
