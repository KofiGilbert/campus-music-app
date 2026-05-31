import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// In-memory OTP store: email → { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post("/auth/otp/send", (req, res): void => {
  const { email } = req.body as { email?: unknown };

  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  const code = generateCode();
  otpStore.set(email.toLowerCase(), { code, expiresAt: Date.now() + OTP_TTL_MS });

  req.log.info({ email }, "OTP generated");

  // In production this would send a real email. For development we expose the
  // code in the response so clients can verify the flow without a mail server.
  const isDev = process.env.NODE_ENV !== "production";
  res.json({ sent: true, ...(isDev ? { devCode: code } : {}) });
});

router.post("/auth/otp/verify", (req, res): void => {
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
  req.log.info({ email }, "OTP verified");
  res.json({ verified: true });
});

export default router;
