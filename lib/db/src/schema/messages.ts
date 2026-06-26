import { sql } from "drizzle-orm";
import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { conversations } from "./conversations";
import { users } from "./schema";
import { tracks } from "./tracks";

// A single message in a conversation. May attach a track and/or image. Soft
// deleted via deletedAt so threads keep a stable cursor.
export const messages = campusMusic.table(
  "messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: varchar("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: varchar("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    attachedTrackId: varchar("attached_track_id").references(() => tracks.id, {
      onDelete: "set null",
    }),
    attachedImageUrl: text("attached_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("messages_conversation_created_idx").on(t.conversationId, t.createdAt.desc()),
    index("messages_sender_idx").on(t.senderUserId),
  ],
);

export type Message = typeof messages.$inferSelect;
