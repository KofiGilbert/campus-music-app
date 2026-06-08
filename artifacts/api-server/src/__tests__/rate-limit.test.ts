import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

// vitest.config sets AUTH_RATE_LIMIT_MAX=5, and each test file runs in its own
// worker with a fresh in-memory limiter store, so this file owns its bucket.
// Empty-body logins get a 400 from the handler *before* any DB call, so the
// pre-limit requests need no database — only the limiter behaviour is exercised.
describe("auth rate limiting", () => {
  it("limits the whole auth surface per IP from one shared bucket", async () => {
    // Spend the budget (5) on /auth/login — each empty body answers 400.
    const logins: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/api/auth/login").send({});
      logins.push(res.status);
    }
    expect(logins.every((s) => s === 400)).toBe(true);

    // The 6th request — on the *OTP* router, not /auth/login — is rejected,
    // proving both that the limit trips and that both routers share one bucket.
    const otp = await request(app).post("/api/auth/otp/send").send({ email: "x@y.z" });
    expect(otp.status).toBe(429);
  });
});
