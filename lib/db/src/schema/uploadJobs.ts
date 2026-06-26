import { sql } from "drizzle-orm";
import { index, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { tracks } from "./tracks";

// Queue consumed by the transcoder worker (apps/transcoder). One row per raw
// audio upload; the worker polls pending rows, transcodes, and marks them done.
export const uploadJobs = campusMusic.table(
  "upload_jobs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    trackId: varchar("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    status: text("status").notNull().default("pending"), // pending|processing|completed|failed
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("upload_jobs_status_created_at_idx").on(t.status, t.createdAt)],
);

export type UploadJob = typeof uploadJobs.$inferSelect;
