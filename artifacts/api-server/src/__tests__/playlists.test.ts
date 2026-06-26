import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { emailService } from "@workspace/email";

const integration = process.env.INTEGRATION === "1";
const uniq = (p: string) => `ci-${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function registerVerified() {
  const email = uniq("u");
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "supersecret", name: "User", role: "listener", university: "U", country: "US" });
  const token = reg.body.accessToken as string;
  vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
  const send = await request(app).post("/api/auth/otp/send").send({ email });
  await request(app).post("/api/auth/otp/verify").send({ email, code: send.body.devCode });
  return { token, userId: reg.body.user.id as string };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe.runIf(integration)("playlists", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates, lists (with Liked Songs), edits, and deletes", async () => {
    const me = await registerVerified();

    const created = await request(app).post("/api/playlists").set(auth(me.token)).send({ name: "Road Trip" });
    expect(created.status).toBe(201);
    expect(created.body.trackCount).toBe(0);
    const id = created.body.id as string;

    const list = await request(app).get("/api/playlists").set(auth(me.token));
    // Virtual Liked Songs is always first.
    expect(list.body.items[0].isLikedSongs).toBe(true);
    expect((list.body.items as { id: string }[]).some((p) => p.id === id)).toBe(true);

    const renamed = await request(app).patch(`/api/playlists/${id}`).set(auth(me.token)).send({ name: "Summer" });
    expect(renamed.body.name).toBe("Summer");

    expect((await request(app).delete(`/api/playlists/${id}`).set(auth(me.token))).status).toBe(204);
  });

  it("enforces ownership + privacy, requires a name", async () => {
    const a = await registerVerified();
    const b = await registerVerified();

    expect((await request(app).post("/api/playlists").set(auth(a.token)).send({})).status).toBe(400);

    const p = await request(app).post("/api/playlists").set(auth(a.token)).send({ name: "Private" });
    const id = p.body.id as string;

    // B can't read A's private playlist, edit, or delete it.
    expect((await request(app).get(`/api/playlists/${id}`).set(auth(b.token))).status).toBe(403);
    expect((await request(app).patch(`/api/playlists/${id}`).set(auth(b.token)).send({ name: "x" })).status).toBe(403);
    expect((await request(app).delete(`/api/playlists/${id}`).set(auth(b.token))).status).toBe(403);

    // Make it public → B can read.
    await request(app).patch(`/api/playlists/${id}`).set(auth(a.token)).send({ isPublic: true });
    expect((await request(app).get(`/api/playlists/${id}`).set(auth(b.token))).status).toBe(200);
  });

  it("exposes the virtual Liked Songs playlist", async () => {
    const me = await registerVerified();
    const liked = await request(app).get("/api/playlists/liked").set(auth(me.token));
    expect(liked.status).toBe(200);
    expect(liked.body.isLikedSongs).toBe(true);
    expect(Array.isArray(liked.body.tracks)).toBe(true);
  });

  it("requires auth", async () => {
    expect((await request(app).get("/api/playlists")).status).toBe(401);
  });
});
