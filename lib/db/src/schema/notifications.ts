import { sql } from "drizzle-orm";
import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

// A single in-app notification for a recipient. `type` drives the icon + copy on
// the client; `actorUserId` is who triggered it (nullable for system); `target`
// is a polymorphic pointer (post|track|comment|conversation|live|connection) the
// client deep-links to. `readAt` null = unread.
export const notifications = campusMusic.table(
  "notifications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type"),
    targetId: varchar("target_id"),
    body: text("body"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("notifications_user_read_idx").on(t.userId, t.readAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;
