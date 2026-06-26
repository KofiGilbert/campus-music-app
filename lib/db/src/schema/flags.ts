import { sql } from "drizzle-orm";
import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

// A user report of content/users for moderation. Polymorphic target (post |
// track | comment | user). status: open | resolved | dismissed.
export const flags = campusMusic.table(
  "flags",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    reporterUserId: varchar("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: varchar("target_id").notNull(),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("open"),
    resolvedByUserId: varchar("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("flags_status_created_idx").on(t.status, t.createdAt.desc()),
    index("flags_reporter_idx").on(t.reporterUserId),
  ],
);

export type Flag = typeof flags.$inferSelect;
