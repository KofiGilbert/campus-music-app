import { randomBytes, createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, refreshTokens } from "@workspace/db";

// Rotating refresh tokens. The raw token is a 32-byte hex string handed to the
// client; only its SHA-256 hash is ever stored. Each login starts a "family"
// (familyId); rotation revokes the presented token and issues a successor in the
// same family. Presenting an already-revoked token is treated as theft and
// revokes the entire family.

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issue a brand-new refresh token starting a fresh family (login / register). */
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hashToken(token),
    familyId: randomUUID(),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return token;
}

export type RotationResult =
  | { ok: true; token: string; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "reused" };

/**
 * Rotate a presented refresh token. On success revokes the old row and inserts a
 * successor in the same family, returning the new raw token. On reuse of an
 * already-revoked token, revokes the whole family and reports "reused".
 */
export async function rotateRefreshToken(presented: string): Promise<RotationResult> {
  const presentedHash = hashToken(presented);
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, presentedHash))
    .limit(1);

  if (!row) return { ok: false, reason: "invalid" };

  if (row.revokedAt) {
    // A revoked token is being presented again — the live successor is out there,
    // so this is almost certainly a stolen/replayed token. Burn the family.
    await revokeFamily(row.familyId);
    return { ok: false, reason: "reused" };
  }

  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const newToken = generateRefreshToken();
  await db.transaction(async (tx) => {
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));
    await tx.insert(refreshTokens).values({
      userId: row.userId,
      tokenHash: hashToken(newToken),
      familyId: row.familyId,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
  });

  return { ok: true, token: newToken, userId: row.userId };
}

/** Revoke the entire family the presented token belongs to (logout). No-op if unknown. */
export async function revokeRefreshTokenFamily(presented: string): Promise<void> {
  const [row] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(presented)))
    .limit(1);
  if (row) await revokeFamily(row.familyId);
}

/** Revoke every live refresh token for a user (password reset, ban). */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

async function revokeFamily(familyId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}
