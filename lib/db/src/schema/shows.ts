import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

// A Campus Music TV show broadcast over Cloudflare Stream (RTMPS in -> HLS out,
// auto-VOD). streamKey + rtmpsUrl are presenter-only and NEVER returned to
// viewers (excluded from the public shape). See DEVIN_ROADMAP §3.17.
export const shows = campusMusic.table(
  "shows",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    type: text("type").notNull().default("special"), // trending|interview|daily_show|takeover|listening_party|special
    status: text("status").notNull().default("scheduled"), // scheduled|live|ended|cancelled
    hostUserId: varchar("host_user_id").references(() => users.id, { onDelete: "set null" }),
    featuredUserIds: jsonb("featured_user_ids").notNull().default([]),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    // Cloudflare Stream linkage. streamKey/rtmpsUrl are sensitive (presenter-only).
    streamId: text("stream_id"),
    streamKey: text("stream_key"),
    rtmpsUrl: text("rtmps_url"),
    playbackUrl: text("playback_url"),
    vodUrl: text("vod_url"),
    thumbnailUrl: text("thumbnail_url"),
    viewerCount: integer("viewer_count").notNull().default(0),
    peakViewerCount: integer("peak_viewer_count").notNull().default(0),
    totalViews: integer("total_views").notNull().default(0),
    chatEnabled: boolean("chat_enabled").notNull().default(true),
    category: text("category"),
    tags: jsonb("tags").notNull().default([]),
    isRecurring: boolean("is_recurring").notNull().default(false),
    recurringSchedule: jsonb("recurring_schedule"), // { dayOfWeek, timeUTC, timezone }
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("shows_status_scheduled_idx").on(t.status, t.scheduledAt.desc()),
    index("shows_status_started_idx").on(t.status, t.startedAt.desc()),
  ],
);

export type Show = typeof shows.$inferSelect;
