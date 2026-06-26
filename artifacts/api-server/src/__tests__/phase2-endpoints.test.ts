import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { emailService } from "@workspace/email";

const integration = process.env.INTEGRATION === "1";
const uniq = (p: string) => `ci-${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function registerVerifiedArtist() {
  const email = uniq("artist");
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "supersecret", name: "Artist", role: "artist", university: "U", country: "US" });
  const token = reg.body.accessToken as string;
  vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
  const send = await request(app).post("/api/auth/otp/send").send({ email });
  await request(app).post("/api/auth/otp/verify").send({ email, code: send.body.devCode });
  return { email, token, userId: reg.body.user.id as string };
}

async function createTrack(token: string) {
  const res = await request(app)
    .post("/api/tracks")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Song", genre: "Indie", sourceKey: "uploads/x/song.mp3", duration: "3:00", durationSeconds: 180 });
  return res.body as { id: string; processingStatus: string };
}

describe.runIf(integration)("play telemetry", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records play history, surfaces it in trending + /me/history, and records skips", async () => {
    const { token } = await registerVerifiedArtist();
    const track = await createTrack(token);
    expect(track.processingStatus).toBe("pending");

    const play = await request(app)
      .post(`/api/tracks/${track.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({ secondsListened: 170, completed: true, source: "feed" });
    expect(play.status).toBe(200);
    expect(play.body.playCount).toBe(1);

    const history = await request(app).get("/api/me/history").set("Authorization", `Bearer ${token}`);
    expect(history.status).toBe(200);
    expect(history.body.history[0].track.id).toBe(track.id);
    expect(history.body.history[0].completed).toBe(true);

    const trending = await request(app).get("/api/tracks/trending?days=7");
    expect(trending.status).toBe(200);
    expect((trending.body as { id: string }[]).some((t) => t.id === track.id)).toBe(true);

    const skip = await request(app)
      .post(`/api/tracks/${track.id}/skip`)
      .set("Authorization", `Bearer ${token}`)
      .send({ secondsBeforeSkip: 8 });
    expect(skip.body).toEqual({ trackId: track.id, recorded: true });
  });

  it("counts an anonymous play without writing history", async () => {
    const { token } = await registerVerifiedArtist();
    const track = await createTrack(token);
    const play = await request(app).post(`/api/tracks/${track.id}/play`).send({ secondsListened: 30 });
    expect(play.status).toBe(200);
    expect(play.body.playCount).toBe(1);
  });
});

describe.runIf(integration)("followers list", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists an artist's followers", async () => {
    const { userId: artistId } = await registerVerifiedArtist();

    const followerEmail = uniq("fan");
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ email: followerEmail, password: "supersecret", name: "Fan", role: "listener", university: "U", country: "US" });
    const followerToken = reg.body.accessToken as string;

    const follow = await request(app)
      .post(`/api/artists/${artistId}/follow`)
      .set("Authorization", `Bearer ${followerToken}`)
      .send({ following: true });
    expect([200, 201]).toContain(follow.status);

    const list = await request(app).get(`/api/artists/${artistId}/followers`);
    expect(list.status).toBe(200);
    expect((list.body.followers as { id: string }[]).some((f) => f.id === reg.body.user.id)).toBe(true);
    expect(list.body).toHaveProperty("nextCursor");
  });
});
