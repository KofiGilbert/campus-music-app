import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Scope a tiny auth budget to THIS file only: stub the env, then dynamically
// import the app so rateLimit.ts reads the stubbed limit at module load. Each
// vitest file runs in its own worker with a fresh module registry + a fresh
// in-memory limiter store, so this owns its bucket and doesn't leak the low
// limit into other test files.
let app: Express;

beforeAll(async () => {
  vi.stubEnv("AUTH_RATE_LIMIT_MAX", "5");
  vi.stubEnv("AUTH_RATE_LIMIT_WINDOW_MS", "60000");
  app = (await import("../app")).default;
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("auth rate limiting", () => {
  it("does not consume the auth bucket for non-auth routes", async () => {
    // Regression test for the router.use() double-count bug. The probe is an
    // UNMATCHED path: it falls through every router — including the auth and
    // otp routers — before 404'ing. Under the old router.use(authLimiter) bug
    // each probe fired the limiter twice (once per router it passed through);
    // with the per-route fix it never touches the limiter. (A matched route
    // like /api/healthz wouldn't work here — it terminates in healthRouter,
    // mounted before auth/otp, so it never passes through them.)
    for (let i = 0; i < 10; i++) {
      const res = await request(app).get("/api/__ratelimit_probe__");
      expect(res.status).toBe(404);
    }

    // …then the full budget of 5 logins must still be available (empty body is
    // a 400 from the handler, before any DB call — no database needed here).
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/api/auth/login").send({});
      expect(res.status).toBe(400);
    }

    // 6th login trips the limiter; an OTP send then also 429 — proving the auth
    // and OTP routes still share one bucket.
    expect((await request(app).post("/api/auth/login").send({})).status).toBe(429);
    expect(
      (await request(app).post("/api/auth/otp/send").send({ email: "x@y.z" })).status,
    ).toBe(429);
  });

  it("does not throttle GET /auth/me", async () => {
    // /auth/me requires a valid JWT; without one it's a 401 every time and must
    // never become a 429 — it's a polled read, excluded from the limiter. The
    // bucket is already exhausted from the previous test, so any throttling
    // would show up immediately.
    for (let i = 0; i < 8; i++) {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    }
  });
});
