import { describe, it, expect, vi, afterEach } from "vitest";
import { jwtVerify } from "jose";
import request from "supertest";
import app from "../app";
import { emailService } from "@workspace/email";
import { JoseLiveKitService } from "../lib/livekit";

const integration = process.env.INTEGRATION === "1";
const uniq = (p: string) => `ci-${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function registerVerified(role: "listener" | "artist" = "artist") {
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

describe("livekit token minting (unit)", () => {
  it("mints a JWT carrying the room grant and publish role", async () => {
    const secret = "test-secret-abcdefghijklmnop";
    const svc = new JoseLiveKitService("APIkey123", secret, "wss://example.livekit.cloud");
    const token = await svc.mintToken({ room: "live_x", identity: "u1", name: "DJ", canPublish: true });
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    expect(payload.sub).toBe("u1");
    expect(payload.iss).toBe("APIkey123");
    const video = payload.video as { room: string; canPublish: boolean; canSubscribe: boolean };
    expect(video.room).toBe("live_x");
    expect(video.canPublish).toBe(true);
    expect(video.canSubscribe).toBe(true);
  });
});

describe.runIf(integration)("live sessions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("starts, lists, ends a session and gates the host action", async () => {
    const host = await registerVerified();
    const other = await registerVerified("listener");

    const created = await request(app)
      .post("/api/live/sessions")
      .set(auth(host.token))
      .send({ title: "Friday set" });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("live");
    expect(created.body.host.id).toBe(host.userId);
    const id = created.body.id as string;

    const list = await request(app).get("/api/live/sessions");
    expect((list.body.items as { id: string }[]).some((s) => s.id === id)).toBe(true);

    // Token endpoint 503s when LiveKit isn't configured (CI default).
    expect((await request(app).post(`/api/live/sessions/${id}/token`).set(auth(host.token))).status).toBe(503);

    // Presence.
    const join = await request(app).post(`/api/live/sessions/${id}/join`).set(auth(other.token));
    expect(join.body.listenerCount).toBe(1);
    const leave = await request(app).post(`/api/live/sessions/${id}/leave`).set(auth(other.token));
    expect(leave.body.listenerCount).toBe(0);

    // Chat.
    expect(
      (await request(app).post(`/api/live/sessions/${id}/chat`).set(auth(other.token)).send({ body: "  " })).status,
    ).toBe(400);
    const chat = await request(app)
      .post(`/api/live/sessions/${id}/chat`)
      .set(auth(other.token))
      .send({ body: "🔥🔥" });
    expect(chat.status).toBe(201);
    const history = await request(app).get(`/api/live/sessions/${id}/chat`);
    expect((history.body.items as { body: string }[]).some((m) => m.body === "🔥🔥")).toBe(true);

    // Non-host cannot end; host can.
    expect((await request(app).post(`/api/live/sessions/${id}/end`).set(auth(other.token))).status).toBe(403);
    const ended = await request(app).post(`/api/live/sessions/${id}/end`).set(auth(host.token));
    expect(ended.body.status).toBe("ended");

    const list2 = await request(app).get("/api/live/sessions");
    expect((list2.body.items as { id: string }[]).some((s) => s.id === id)).toBe(false);
  });
});
