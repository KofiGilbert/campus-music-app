import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { emailService } from "@workspace/email";

function uniqueEmail() {
  return `ci-verify-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

const integration = process.env.INTEGRATION === "1";

describe.runIf(integration)("email verification gate + OTP", () => {
  afterEach(() => vi.restoreAllMocks());

  it("registers with emailVerified=false and blocks POST /tracks (403)", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      email: uniqueEmail(),
      password: "supersecret",
      name: "Artist",
      role: "artist",
      university: "Test University",
      country: "US",
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user.emailVerified).toBe(false);
    const accessToken = reg.body.accessToken as string;

    const res = await request(app)
      .post("/api/tracks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Song", genre: "Indie", audioUrl: "x", duration: "3:00", durationSeconds: 180 });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Email verification required" });
  });

  it("OTP send emails the code; verify marks the user verified", async () => {
    const email = uniqueEmail();
    const reg = await request(app).post("/api/auth/register").send({
      email,
      password: "supersecret",
      name: "User",
      role: "listener",
      university: "Test University",
      country: "US",
    });
    const accessToken = reg.body.accessToken as string;

    const spy = vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
    const send = await request(app).post("/api/auth/otp/send").send({ email });
    expect(send.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    // NODE_ENV=test => not production => devCode is returned for the test to use.
    const devCode = send.body.devCode as string;
    expect(typeof devCode).toBe("string");

    const verify = await request(app).post("/api/auth/otp/verify").send({ email, code: devCode });
    expect(verify.status).toBe(200);
    expect(verify.body).toEqual({ verified: true });

    // /auth/me now reports the user as verified.
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.emailVerified).toBe(true);
  });

  it("rejects an incorrect OTP code", async () => {
    const email = uniqueEmail();
    vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
    await request(app).post("/api/auth/otp/send").send({ email });
    const verify = await request(app).post("/api/auth/otp/verify").send({ email, code: "000000" });
    expect(verify.status).toBe(400);
  });
});
