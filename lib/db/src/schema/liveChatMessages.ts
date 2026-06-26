import { sql } from "drizzle-orm";
import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { liveSessions } from "./liveSessions";
import { users } from "./schema";

// Chat in a live session. Persisted so late joiners can fetch recent history;
// real-time delivery is over the socket (room live:<sessionId>).
export const liveChatMessages = campusMusic.table(
  "live_chat_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id")
      .notNull()
      .references(() => liveSessions.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("live_chat_session_created_idx").on(t.sessionId, t.createdAt.desc())],
);

export type LiveChatMessage = typeof liveChatMessages.$inferSelect;
