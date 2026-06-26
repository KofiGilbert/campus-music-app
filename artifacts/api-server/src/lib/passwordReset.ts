import { randomBytes, createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, passwordResetTokens } from "@workspace/db";

// One-time password reset tokens. Like refresh tokens, only the SHA-256 hash of
// the raw token is stored; the raw value goes out in the reset email only.

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a one-hour reset token for a user; returns the raw token to email. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  return token;
}

/**
 * Validate and consume a reset token. Returns the userId on success (marking it
 * used in the same conditional update to make consumption atomic), or null if
 * the token is unknown, expired, or already used.
 */
export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, hash(rawToken)))
    .limit(1);

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;

  // Mark used only if still unused — guards against two concurrent resets.
  const consumed = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
    .returning({ id: passwordResetTokens.id });

  return consumed.length > 0 ? row.userId : null;
}
