import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

// Rate limiting for the auth surface (login, register, OTP send/verify).
//
// MVP is single-node, so the default in-memory store is sufficient — counters
// live in the process and reset on restart. When we scale past one instance the
// store must move to Redis (express-rate-limit ./redis-store), otherwise each
// node enforces its own bucket and the effective limit multiplies by node count.
//
// Keyed by client IP. Behind Fly's proxy this requires `trust proxy` to be set
// (see app.ts) so req.ip is the real client, not the proxy hop — without it
// every request shares one bucket and a single abuser locks out everyone.
//
// The window/limit are env-overridable so tests can trip the limiter cheaply
// (a handful of requests) instead of hammering it hundreds of times.
const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const limit = Number(process.env.AUTH_RATE_LIMIT_MAX) || 30;

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs,
  limit,
  standardHeaders: "draft-7", // RateLimit / RateLimit-Policy headers
  legacyHeaders: false, // drop the deprecated X-RateLimit-* headers
  message: { error: "Too many requests, please try again later" },
});
