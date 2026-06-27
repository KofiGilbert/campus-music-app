import { index, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { shows } from "./shows";
import { users } from "./schema";

// "Remind me" registrations for upcoming shows. A cron-ish sweep notifies users
// ~10 min before a show goes live (notified flips true).
export const showReminders = campusMusic.table(
  "show_reminders",
  {
    showId: varchar("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.showId, t.userId] }),
    index("show_reminders_user_idx").on(t.userId),
  ],
);

export type ShowReminder = typeof showReminders.$inferSelect;
