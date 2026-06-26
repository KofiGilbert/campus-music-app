import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { emailService, passwordResetEmailTemplate } from "@workspace/email";
import { signToken } from "../lib/jwt";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshTokenFamily,
  revokeAllUserRefreshTokens,
} from "../lib/refreshTokens";
import { createPasswordResetToken, consumePasswordResetToken } from "../lib/passwordReset";
import { requireAuth } from "../middlewares/auth";
import { authLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

// Base URL for links in emails (password reset). Points at the app's deep-link
// / web handler for /reset-password.
const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://campus-music.app";

// authLimiter is attached PER-ROUTE below, not via router.use(). These routers
// are mounted without a path prefix, so a router-level limiter would fire for
// every request that merely passes THROUGH this router on its way to a later
// one (feed, search, …) — double-counting non-auth traffic against the auth
// bucket. Inline on the brute-forceable routes only: register/signup/login here,
// otp/send + otp/verify in otp.ts. logout (stateless) and /auth/me (read, already
// gated by requireAuth, polled by the app) are intentionally unthrottled.

function buildUserResponse(user: {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  university: string | null;
  country: string | null;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    role: user.role ?? "listener",
    university: user.university ?? "",
    country: user.country ?? "",
    avatarUrl: user.avatarUrl ?? null,
  };
}

async function registerUser(
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1]
): Promise<void> {
  const { email, password, name, role, university, country } = req.body as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
    role?: unknown;
    university?: unknown;
    country?: unknown;
  };

  if (
    typeof email !== "string" || !email ||
    typeof password !== "string" || password.length < 6 ||
    typeof name !== "string" || !name ||
    typeof role !== "string" || !["listener", "artist"].includes(role) ||
    typeof university !== "string" || !university ||
    typeof country !== "string" || !country
  ) {
    res.status(400).json({ error: "Invalid registration data" });
    return;
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      username: email,
      email,
      password: hashedPassword,
      name,
      role: role as "listener" | "artist",
      university,
      country,
    })
    .returning();

  const accessToken = await signToken({
    sub: newUser.id,
    role: newUser.role,
    isAdmin: newUser.isAdmin,
    isSystem: newUser.isSystem,
  });
  const refreshToken = await issueRefreshToken(newUser.id);
  req.log.info({ userId: newUser.id }, "User registered");

  // `token` is a legacy alias for `accessToken` kept until the mobile client
  // migrates to the access/refresh pair.
  res.status(201).json({
    token: accessToken,
    accessToken,
    refreshToken,
    user: buildUserResponse(newUser),
  });
}

router.post("/auth/register", authLimiter, async (req, res): Promise<void> => {
  await registerUser(req, res);
});

router.post("/auth/signup", authLimiter, async (req, res): Promise<void> => {
  await registerUser(req, res);
});

router.post("/auth/login", authLimiter, async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: unknown; password?: unknown };

  if (typeof email !== "string" || !email || typeof password !== "string" || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // System accounts (seeded artists) have a sentinel password and must never log
  // in. Short-circuit before bcrypt-compare.
  if (user.isSystem) {
    res.status(403).json({ error: "system accounts cannot log in" });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const accessToken = await signToken({
    sub: user.id,
    role: user.role,
    isAdmin: user.isAdmin,
    isSystem: user.isSystem,
  });
  const refreshToken = await issueRefreshToken(user.id);
  req.log.info({ userId: user.id }, "User logged in");

  res.json({
    token: accessToken, // legacy alias, see registerUser
    accessToken,
    refreshToken,
    user: buildUserResponse(user),
  });
});

/**
 * POST /auth/refresh — rotate a refresh token. Returns a fresh access token and
 * a new refresh token (the old one is revoked). Not rate-limited: it's a
 * high-frequency legitimate call already gated by possession of a 32-byte random
 * token, and reuse detection handles theft. Access-token claims are re-read from
 * the user's row, so role/admin changes propagate within one refresh.
 */
router.post("/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: unknown };
  if (typeof refreshToken !== "string" || !refreshToken) {
    res.status(400).json({ error: "refreshToken is required" });
    return;
  }

  const result = await rotateRefreshToken(refreshToken);
  if (!result.ok) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, result.userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const accessToken = await signToken({
    sub: user.id,
    role: user.role,
    isAdmin: user.isAdmin,
    isSystem: user.isSystem,
  });
  res.json({ token: accessToken, accessToken, refreshToken: result.token });
});

/**
 * POST /auth/logout — revokes the entire refresh-token family the presented
 * token belongs to (signs the session out on this device). Idempotent: a missing
 * or unknown token still returns success.
 */
router.post("/auth/logout", async (req, res): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: unknown };
  if (typeof refreshToken === "string" && refreshToken) {
    await revokeRefreshTokenFamily(refreshToken);
  }
  res.json({ message: "Logged out successfully" });
});

/**
 * POST /auth/password/forgot — start a password reset. Always responds
 * { sent: true } whether or not the email exists, so it can't be used to probe
 * which emails are registered. System accounts (which can't log in) are skipped.
 */
router.post("/auth/password/forgot", authLimiter, async (req, res): Promise<void> => {
  const { email } = req.body as { email?: unknown };
  if (typeof email !== "string" || !email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db
    .select({ id: users.id, isSystem: users.isSystem })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user && !user.isSystem) {
    const token = await createPasswordResetToken(user.id);
    const template = passwordResetEmailTemplate(`${APP_BASE_URL}/reset-password?token=${token}`);
    try {
      await emailService.sendEmail({ to: email, ...template });
    } catch (err) {
      // Don't fail the request (or leak failure) if the provider hiccups.
      req.log.error({ err }, "Failed to send password reset email");
    }
  }

  res.json({ sent: true });
});

/**
 * POST /auth/password/reset — complete a password reset. Consumes a valid
 * (unexpired, unused) token, sets the new password, and revokes every refresh
 * token for the user so all existing sessions are signed out.
 */
router.post("/auth/password/reset", authLimiter, async (req, res): Promise<void> => {
  const { token, newPassword } = req.body as { token?: unknown; newPassword?: unknown };
  if (
    typeof token !== "string" ||
    !token ||
    typeof newPassword !== "string" ||
    newPassword.length < 6
  ) {
    res.status(400).json({ error: "A token and a password (min 6 characters) are required" });
    return;
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await revokeAllUserRefreshTokens(userId);

  req.log.info({ userId }, "Password reset");
  res.json({ reset: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(buildUserResponse(user));
});

router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!; // guaranteed by requireAuth

  const { name, university, country, avatarUrl } = req.body as { name?: unknown; university?: unknown; country?: unknown; avatarUrl?: unknown };

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({ error: "Name must be a non-empty string" });
    return;
  }

  const updates: { name?: string; university?: string; country?: string; avatarUrl?: string | null } = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof university === "string") updates.university = university.trim();
  if (typeof country === "string") updates.country = country.trim();
  if (avatarUrl === null || typeof avatarUrl === "string") updates.avatarUrl = avatarUrl ?? null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.log.info({ userId }, "User profile updated");
  res.json(buildUserResponse(updated));
});

export default router;
