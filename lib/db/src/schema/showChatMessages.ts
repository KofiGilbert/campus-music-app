import { sql } from "drizzle-orm";
import { boolean, index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { shows } from "./shows";
import { users } from "./schema";

// Chat in a TV show. Persisted for late joiners; real-time delivery is over the
// socket (room tv:<showId>). Moderators can hide messages.
export const showChatMessages = campusMusic.table(
  "show_chat_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    showId: varchar("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull().default(""),
    message: text("message").notNull(),
    type: text("type").notNull().default("message"), // message|system|highlight|featured
    isModerated: boolean("is_moderated").notNull().default(false),
    moderatedByUserId: varchar("moderated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("show_chat_show_created_idx").on(t.showId, t.createdAt.desc())],
);

export type ShowChatMessage = typeof showChatMessages.$inferSelect;
