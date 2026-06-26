import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { emailService, otpEmailTemplate } from "@workspace/email";
import { authLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

// authLimiter is attached per-route (send/verify) below, not via router.use() —
// see the explanation in routes/auth.ts. Same instance, so OTP shares the auth
// bucket; mounting it router-level here would throttle unrelated downstream
// routes that merely pass through this router.

// In-memory OTP store: email → { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/auth/otp/send", authLimiter, async (req, res): Promise<void> => {
  const { email } = req.body as { email?: unknown };

  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const code = generateCode();
  otpStore.set(email.toLowerCase(), { code, expiresAt: Date.now() + OTP_TTL_MS });

  try {
    await emailService.sendEmail({ to: email, ...otpEmailTemplate(code) });
  } catch (err) {
    req.log.error({ err }, "Failed to send OTP email");
    res.status(500).json({ error: "Failed to send verification code" });
    return;
  }

  req.log.info({ email }, "OTP sent");

  // devCode is exposed only outside production, so the flow can be tested without
  // a real inbox; it is never returned in production.
  const isDev = process.env.NODE_ENV !== "production";
  res.json({ sent: true, ...(isDev ? { devCode: code } : {}) });
});

router.post("/auth/otp/verify", authLimiter, async (req, res): Promise<void> => {
  const { email, code } = req.body as { email?: unknown; code?: unknown };

  if (typeof email !== "string" || !email || typeof code !== "string" || !code) {
    res.status(400).json({ error: "Email and code are required" });
    return;
  }

  const stored = otpStore.get(email.toLowerCase());

  if (!stored) {
    res.status(400).json({ error: "No OTP found for this email. Please request a new code." });
    return;
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email.toLowerCase());
    res.status(400).json({ error: "Code has expired. Please request a new one." });
    return;
  }

  if (stored.code !== code.trim()) {
    res.status(400).json({ error: "Incorrect code. Please try again." });
    return;
  }

  otpStore.delete(email.toLowerCase());

  // Mark the email verified for the matching user. No-op if the user doesn't
  // exist yet (e.g. OTP requested before registration completes).
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.email, email.toLowerCase()));

  req.log.info({ email }, "OTP verified");
  res.json({ verified: true });
});

export default router;
