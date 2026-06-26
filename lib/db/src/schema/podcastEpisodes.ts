import { sql } from "drizzle-orm";
import { index, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { podcasts } from "./podcasts";

// One episode of a podcast. `audioKey` is an R2 object key (signed at read time)
// or a passthrough http(s) URL. Single audio file — no multi-bitrate transcode
// (the transcoder pipeline is track-only for now).
export const podcastEpisodes = campusMusic.table(
  "podcast_episodes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    podcastId: varchar("podcast_id")
      .notNull()
      .references(() => podcasts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    audioKey: text("audio_key").notNull(),
    durationSeconds: integer("duration_seconds"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("podcast_episodes_podcast_published_idx").on(t.podcastId, t.publishedAt.desc())],
);

export type PodcastEpisode = typeof podcastEpisodes.$inferSelect;
