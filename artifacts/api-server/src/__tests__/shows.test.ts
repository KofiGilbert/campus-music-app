import { describe, it, expect, vi, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import app from "../app";
import { db, users } from "@workspace/db";
import { emailService } from "@workspace/email";

const integration = process.env.INTEGRATION === "1";
const uniq = (p: string) => `ci-${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function registerVerified() {
  const email = uniq("u");
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "supersecret", name: "User", role: "listener", university: "U", country: "US" });
  vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
  const send = await request(app).post("/api/auth/otp/send").send({ email });
  await request(app).post("/api/auth/otp/verify").send({ email, code: send.body.devCode });
  return { token: reg.body.accessToken as string, userId: reg.body.user.id as string, email };
}

async function makeAdmin(email: string) {
  await db.update(users).set({ isAdmin: true }).where(eq(users.email, email));
  const login = await request(app).post("/api/auth/login").send({ email, password: "supersecret" });
  return login.body.accessToken as string;
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe.runIf(integration)("campus music tv", () => {
  afterEach(() => vi.restoreAllMocks());

  it("runs a show lifecycle and keeps the stream key private", async () => {
    const viewer = await registerVerified();
    const adminUser = await registerVerified();
    const adminToken = await makeAdmin(adminUser.email);

    // Non-admin cannot schedule.
    expect((await request(app).post("/api/shows").set(auth(viewer.token)).send({ title: "x" })).status).toBe(403);

    const created = await request(app).post("/api/shows").set(auth(adminToken)).send({ title: "Trending Tonight", type: "trending" });
    expect(created.status).toBe(201);
    const showId = created.body.id as string;
    expect(created.body.status).toBe("scheduled");

    // Appears under upcoming.
    const upcoming = await request(app).get("/api/shows?status=upcoming");
    expect((upcoming.body.items as { id: string }[]).some((s) => s.id === showId)).toBe(true);

    // Remind me.
    expect((await request(app).post(`/api/shows/${showId}/remind-me`).set(auth(viewer.token))).body.reminded).toBe(true);

    // Start → live, returns presenter ingest; public shape hides the key.
    const started = await request(app).post(`/api/shows/${showId}/start`).set(auth(adminToken));
    expect(started.body.status).toBe("live");
    expect(started.body.ingest.rtmpsUrl).toBeTruthy();
    expect(started.body.ingest.streamKey).toBeTruthy();
    expect(started.body.streamKey).toBeUndefined();

    const pub = await request(app).get(`/api/shows/${showId}`);
    expect(pub.body.streamKey).toBeUndefined();
    expect(pub.body.rtmpsUrl).toBeUndefined();
    expect(pub.body.playbackUrl).toBeTruthy();

    // Viewer presence.
    expect((await request(app).post(`/api/shows/${showId}/join`)).body.viewerCount).toBe(1);

    // Chat (verified) + history.
    const chat = await request(app).post(`/api/shows/${showId}/chat`).set(auth(viewer.token)).send({ message: "hi tv" });
    expect(chat.status).toBe(201);
    const history = await request(app).get(`/api/shows/${showId}/chat`);
    expect((history.body.items as { message: string }[]).some((m) => m.message === "hi tv")).toBe(true);

    // End → ended + VOD url.
    const ended = await request(app).post(`/api/shows/${showId}/end`).set(auth(adminToken));
    expect(ended.body.status).toBe("ended");
    expect(ended.body.vodUrl).toBeTruthy();
  });
});
