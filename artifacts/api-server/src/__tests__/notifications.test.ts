import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { emailService } from "@workspace/email";

const integration = process.env.INTEGRATION === "1";
const uniq = (p: string) => `ci-${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function registerVerified(role: "listener" | "artist" = "listener") {
  const email = uniq(role);
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "supersecret", name: "User", role, university: "U", country: "US" });
  const token = reg.body.accessToken as string;
  vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
  const send = await request(app).post("/api/auth/otp/send").send({ email });
  await request(app).post("/api/auth/otp/verify").send({ email, code: send.body.devCode });
  return { token, userId: reg.body.user.id as string };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe.runIf(integration)("notifications", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a follow notification, counts unread, and marks read", async () => {
    const artist = await registerVerified("artist");
    const fan = await registerVerified("listener");

    await request(app).post(`/api/artists/${artist.userId}/follow`).set(auth(fan.token)).send({ following: true });

    const inbox = await request(app).get("/api/notifications").set(auth(artist.token));
    const follow = (inbox.body.items as { type: string; actor: { id: string } }[]).find((n) => n.type === "follow");
    expect(follow?.actor.id).toBe(fan.userId);

    const unread = await request(app).get("/api/notifications/unread-count").set(auth(artist.token));
    expect(unread.body.count).toBeGreaterThanOrEqual(1);

    expect((await request(app).post("/api/notifications/read-all").set(auth(artist.token))).status).toBe(200);
    const unread2 = await request(app).get("/api/notifications/unread-count").set(auth(artist.token));
    expect(unread2.body.count).toBe(0);
  });

  it("respects per-type opt-out", async () => {
    const artist = await registerVerified("artist");
    const fan = await registerVerified("listener");

    // Artist opts out of follow notifications.
    await request(app).patch("/api/notifications/prefs").set(auth(artist.token)).send({ prefs: { follow: false } });
    const prefs = await request(app).get("/api/notifications/prefs").set(auth(artist.token));
    expect(prefs.body.prefs.follow).toBe(false);

    await request(app).post(`/api/artists/${artist.userId}/follow`).set(auth(fan.token)).send({ following: true });
    const inbox = await request(app).get("/api/notifications").set(auth(artist.token));
    expect((inbox.body.items as { type: string }[]).some((n) => n.type === "follow")).toBe(false);
  });

  it("registers and unregisters a push token", async () => {
    const u = await registerVerified();
    expect(
      (await request(app).post("/api/push/tokens").set(auth(u.token)).send({ token: "ExponentPushToken[abc]", platform: "ios" }))
        .status,
    ).toBe(201);
    // Idempotent re-register.
    expect(
      (await request(app).post("/api/push/tokens").set(auth(u.token)).send({ token: "ExponentPushToken[abc]", platform: "ios" }))
        .status,
    ).toBe(201);
    expect((await request(app).delete("/api/push/tokens").set(auth(u.token)).send({ token: "ExponentPushToken[abc]" })).status).toBe(
      200,
    );
    expect((await request(app).post("/api/push/tokens").set(auth(u.token)).send({})).status).toBe(400);
  });

  it("requires auth on the inbox", async () => {
    expect((await request(app).get("/api/notifications")).status).toBe(401);
  });
});
