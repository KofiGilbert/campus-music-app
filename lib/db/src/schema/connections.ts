import { text, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

export const userConnections = campusMusic.table(
  "user_connections",
  {
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted"] }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.fromUserId, t.toUserId] })],
);

export type UserConnection = typeof userConnections.$inferSelect;
