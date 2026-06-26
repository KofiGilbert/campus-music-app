import { index, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { conversations } from "./conversations";
import { users } from "./schema";

// Membership of a user in a conversation. `lastReadAt` powers unread counts and
// read receipts; it is advanced whenever the user marks the thread read.
export const conversationParticipants = campusMusic.table(
  "conversation_participants",
  {
    conversationId: varchar("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("conversation_participants_user_idx").on(t.userId),
  ],
);

export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
