import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { emailService } from "@workspace/email";

function uniqueEmail() {
  return `ci-reset-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

const integration = process.env.INTEGRATION === "1";

describe.runIf(integration)("password reset", () => {
  afterEach(() => vi.restoreAllMocks());

  it("forgot -> reset -> login with the new password; the token is single-use", async () => {
    const email = uniqueEmail();
    const oldPassword = "supersecret";
    const newPassword = "BrandNewPass1";
    await request(app).post("/api/auth/register").send({
      email,
      password: oldPassword,
      name: "Reset User",
      role: "listener",
      university: "Test University",
      country: "US",
    });

    // Capture the reset link the email would carry.
    const spy = vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
    const forgot = await request(app).post("/api/auth/password/forgot").send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body).toEqual({ sent: true });
    expect(spy).toHaveBeenCalledOnce();

    const message = spy.mock.calls[0][0];
    const token = /token=([a-f0-9]+)/.exec(`${message.text}\n${message.html}`)?.[1];
    expect(token).toBeTruthy();

    const reset = await request(app).post("/api/auth/password/reset").send({ token, newPassword });
    expect(reset.status).toBe(200);
    expect(reset.body).toEqual({ reset: true });

    // Old password no longer works; the new one does.
    expect((await request(app).post("/api/auth/login").send({ email, password: oldPassword })).status).toBe(
      401,
    );
    expect((await request(app).post("/api/auth/login").send({ email, password: newPassword })).status).toBe(
      200,
    );

    // The reset token cannot be replayed.
    expect(
      (await request(app).post("/api/auth/password/reset").send({ token, newPassword: "AnotherPass1" }))
        .status,
    ).toBe(400);
  });

  it("forgot returns { sent: true } for an unknown email (no enumeration)", async () => {
    const res = await request(app).post("/api/auth/password/forgot").send({ email: uniqueEmail() });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: true });
  });

  it("rejects an invalid reset token and a weak password", async () => {
    expect(
      (await request(app).post("/api/auth/password/reset").send({ token: "deadbeef", newPassword: "GoodPass1" }))
        .status,
    ).toBe(400);
    expect(
      (await request(app).post("/api/auth/password/reset").send({ token: "deadbeef", newPassword: "x" })).status,
    ).toBe(400);
  });
});
