import { sql } from "drizzle-orm";
import { index, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

// An Expo push token registered by one of a user's devices. `token` is unique so
// re-registering the same device upserts rather than duplicates. Removed on
// logout or when Expo reports the token as unregistered.
export const pushTokens = campusMusic.table(
  "push_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull().default("unknown"), // ios | android | web
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("push_tokens_token_idx").on(t.token),
    index("push_tokens_user_idx").on(t.userId),
  ],
);

export type PushToken = typeof pushTokens.$inferSelect;
