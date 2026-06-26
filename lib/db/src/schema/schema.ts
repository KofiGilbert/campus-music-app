import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campusMusic } from "./namespace";

export const users = campusMusic.table(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
    email: text("email").notNull().unique(),
    name: text("name").notNull().default(""),
    role: text("role", { enum: ["listener", "artist"] }).notNull().default("listener"),
    university: text("university").notNull().default(""),
    country: text("country").notNull().default(""),
    avatarUrl: text("avatar_url"),
    // Artist profile fields (collapsed from the former `artists` table).
    bio: text("bio").notNull().default(""),
    genre: text("genre"),
    coverColor: text("cover_color"),
    // System (seeded a1..a10) + admin flags; timestamps.
    isSystem: boolean("is_system").notNull().default(false),
    isAdmin: boolean("is_admin").notNull().default(false),
    emailVerified: boolean("email_verified").notNull().default(false),
    // AI: denormalized credit balance + granular consent flags.
    aiCredits: integer("ai_credits").notNull().default(0),
    aiConsent: jsonb("ai_consent").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Every artist lookup filters on role='artist'.
  (t) => [index("users_role_idx").on(t.role)],
);

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
  role: true,
  university: true,
  country: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
