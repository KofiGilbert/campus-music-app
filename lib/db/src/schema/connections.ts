import { text, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";

export const userConnections = campusMusic.table("user_connections", {
  fromUserId: text("from_user_id").notNull(),
  toUserId: text("to_user_id").notNull(),
  status: text("status", { enum: ["pending", "accepted"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.fromUserId, t.toUserId] })]);

export type UserConnection = typeof userConnections.$inferSelect;
