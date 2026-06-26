import { sql } from "drizzle-orm";
import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";

// Refresh tokens for rotating-refresh auth. The raw token is never stored —
// only its SHA-256 hash. `familyId` groups every token derived from one login
// session so a detected reuse can revoke the whole family (theft response).
export const refreshTokens = campusMusic.table(
  "refresh_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    familyId: varchar("family_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // non-null = dead
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("refresh_tokens_token_hash_idx").on(t.tokenHash), // looked up every refresh
    index("refresh_tokens_user_id_idx").on(t.userId), // revoke-all-for-user
  ],
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
