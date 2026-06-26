import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import { generateRefreshToken, hashToken } from "../lib/refreshTokens";

function uniqueEmail() {
  return `ci-refresh-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

const baseUser = (email: string) => ({
  email,
  password: "supersecret",
  name: "Refresh User",
  role: "listener",
  university: "Test University",
  country: "US",
});

// DB-free unit checks always run.
describe("refresh token helpers", () => {
  it("generates a 64-char hex token and hashes deterministically", () => {
    const t = generateRefreshToken();
    expect(t).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
  });
});

// Rotation flow needs a real DB; runs in CI (INTEGRATION=1) and skips locally.
const integration = process.env.INTEGRATION === "1";

describe.runIf(integration)("refresh token rotation", () => {
  it("rotates a token into a new pair and invalidates the old one", async () => {
    const reg = await request(app).post("/api/auth/register").send(baseUser(uniqueEmail()));
    expect(reg.status).toBe(201);
    const refreshToken = reg.body.refreshToken as string;
    expect(typeof refreshToken).toBe("string");

    const r1 = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(r1.status).toBe(200);
    expect(typeof r1.body.accessToken).toBe("string");
    const newRefresh = r1.body.refreshToken as string;
    expect(newRefresh).not.toBe(refreshToken);

    // The freshly issued token rotates again fine.
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: newRefresh })).status).toBe(
      200,
    );
  });

  it("detects reuse: replaying a rotated token 401s and burns the family", async () => {
    const reg = await request(app).post("/api/auth/register").send(baseUser(uniqueEmail()));
    const original = reg.body.refreshToken as string;

    const r1 = await request(app).post("/api/auth/refresh").send({ refreshToken: original });
    const live = r1.body.refreshToken as string;

    // Replay the now-revoked original token → reuse detected.
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: original })).status).toBe(
      401,
    );

    // Reuse revokes the whole family, so the previously-live successor is dead too.
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken: live })).status).toBe(401);
  });

  it("rejects unknown (401) and missing (400) refresh tokens", async () => {
    expect(
      (await request(app).post("/api/auth/refresh").send({ refreshToken: "not-a-real-token" })).status,
    ).toBe(401);
    expect((await request(app).post("/api/auth/refresh").send({})).status).toBe(400);
  });

  it("logout revokes the token's family", async () => {
    const reg = await request(app).post("/api/auth/register").send(baseUser(uniqueEmail()));
    const refreshToken = reg.body.refreshToken as string;

    expect((await request(app).post("/api/auth/logout").send({ refreshToken })).status).toBe(200);
    expect((await request(app).post("/api/auth/refresh").send({ refreshToken })).status).toBe(401);
  });
});
