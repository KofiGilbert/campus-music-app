import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { emailService } from "@workspace/email";

const integration = process.env.INTEGRATION === "1";
const uniq = (p: string) => `ci-${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function registerVerified(role: "listener" | "artist" = "artist") {
  const email = uniq(role);
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "supersecret", name: "User", role, university: "Podcast U", country: "US" });
  const token = reg.body.accessToken as string;
  vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
  const send = await request(app).post("/api/auth/otp/send").send({ email });
  await request(app).post("/api/auth/otp/verify").send({ email, code: send.body.devCode });
  return { token, userId: reg.body.user.id as string };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe.runIf(integration)("podcasts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a series, publishes episodes, and handles subscriptions", async () => {
    const host = await registerVerified("artist");
    const listener = await registerVerified("listener");

    // Listener cannot create.
    expect((await request(app).post("/api/podcasts").set(auth(listener.token)).send({ title: "Nope" })).status).toBe(403);

    const created = await request(app)
      .post("/api/podcasts")
      .set(auth(host.token))
      .send({ title: "The Quad Cast", description: "Campus talk", university: "Podcast U" });
    expect(created.status).toBe(201);
    expect(created.body.host.id).toBe(host.userId);
    const podcastId = created.body.id as string;

    // Listing + filtering.
    const list = await request(app).get("/api/podcasts").query({ university: "Podcast U" });
    expect((list.body.items as { id: string }[]).some((p) => p.id === podcastId)).toBe(true);

    // Publish an episode (host); non-host blocked; audioKey required.
    expect(
      (await request(app).post(`/api/podcasts/${podcastId}/episodes`).set(auth(listener.token)).send({ title: "x", audioKey: "k" }))
        .status,
    ).toBe(403);
    expect(
      (await request(app).post(`/api/podcasts/${podcastId}/episodes`).set(auth(host.token)).send({ title: "no audio" }))
        .status,
    ).toBe(400);
    const ep = await request(app)
      .post(`/api/podcasts/${podcastId}/episodes`)
      .set(auth(host.token))
      .send({ title: "Episode 1", audioKey: "podcasts/ep1.m4a", durationSeconds: 1800 });
    expect(ep.status).toBe(201);
    expect(ep.body.audioUrl).toBeTruthy();

    const episodes = await request(app).get(`/api/podcasts/${podcastId}/episodes`);
    expect((episodes.body.items as { title: string }[]).some((e) => e.title === "Episode 1")).toBe(true);

    // Subscribe toggle.
    const sub = await request(app).post(`/api/podcasts/${podcastId}/subscribe`).set(auth(listener.token));
    expect(sub.body).toEqual({ subscribed: true, subscriberCount: 1 });
    const subbed = await request(app).get("/api/podcasts/subscribed").set(auth(listener.token));
    expect((subbed.body.items as { id: string }[]).some((p) => p.id === podcastId)).toBe(true);
    const unsub = await request(app).post(`/api/podcasts/${podcastId}/subscribe`).set(auth(listener.token));
    expect(unsub.body).toEqual({ subscribed: false, subscriberCount: 0 });

    // Delete (non-host 403, host 204).
    expect((await request(app).delete(`/api/podcasts/${podcastId}`).set(auth(listener.token))).status).toBe(403);
    expect((await request(app).delete(`/api/podcasts/${podcastId}`).set(auth(host.token))).status).toBe(204);
    expect((await request(app).get(`/api/podcasts/${podcastId}`)).status).toBe(404);
  });
});
