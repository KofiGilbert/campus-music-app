import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

// Happy-path auth flow against a REAL Postgres. Gated behind INTEGRATION=1 so a
// plain `pnpm test` (placeholder DB, e.g. on the Windows dev box) skips it; CI
// sets INTEGRATION=1, provisions a Postgres service container, and creates the
// schema before running the suite.
const integration = process.env.INTEGRATION === "1";

describe.runIf(integration)("auth happy path (register -> login -> me)", () => {
  // Unique email per run so reruns against a persistent DB don't 409.
  const email = `ci-${Date.now()}@example.test`;
  const password = "supersecret";
  const credentials = {
    email,
    password,
    name: "CI User",
    role: "listener",
    university: "Test University",
    country: "US",
  };

  it("registers a new user and returns a token", async () => {
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({ email, role: "listener" });
  });

  it("rejects a duplicate registration with 409", async () => {
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(res.status).toBe(409);
  });

  it("logs in with the right password and returns a token", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("returns the current user from /auth/me with a valid token", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const token = login.body.token as string;

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email, role: "listener" });
  });

  it("rejects /auth/me without a token (401)", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
