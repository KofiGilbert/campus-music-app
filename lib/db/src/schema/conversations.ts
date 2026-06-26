import { sql } from "drizzle-orm";
import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";

// A conversation thread. `dm` is a 1:1 thread between exactly two participants;
// `group` supports N participants (same schema, P1 surface). `lastMessageAt`
// drives the conversation-list ordering without a join on messages.
export const conversations = campusMusic.table(
  "conversations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    type: text("type").notNull().default("dm"), // dm | group
    title: text("title"), // optional, group threads only
    createdByUserId: varchar("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_last_message_idx").on(t.lastMessageAt.desc())],
);

export type Conversation = typeof conversations.$inferSelect;
