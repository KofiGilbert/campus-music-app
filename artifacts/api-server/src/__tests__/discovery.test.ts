import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { emailService } from "@workspace/email";

const integration = process.env.INTEGRATION === "1";
const rnd = () => Math.floor(Math.random() * 1e6);
const uniq = (p: string) => `ci-${p}-${Date.now()}-${rnd()}@example.test`;

async function registerVerified(opts: { role?: "listener" | "artist"; name?: string; university?: string } = {}) {
  const email = uniq(opts.role ?? "u");
  const reg = await request(app).post("/api/auth/register").send({
    email,
    password: "supersecret",
    name: opts.name ?? "User",
    role: opts.role ?? "listener",
    university: opts.university ?? "Test University",
    country: "US",
  });
  const token = reg.body.accessToken as string;
  vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
  const send = await request(app).post("/api/auth/otp/send").send({ email });
  await request(app).post("/api/auth/otp/verify").send({ email, code: send.body.devCode });
  return { token, userId: reg.body.user.id as string };
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe.runIf(integration)("search + discovery", () => {
  afterEach(() => vi.restoreAllMocks());

  it("finds an artist and a user by name via faceted search", async () => {
    const tag = `Zorptastic${rnd()}`;
    await registerVerified({ role: "artist", name: `${tag} Artist` });
    await registerVerified({ role: "listener", name: `${tag} Listener` });

    const artists = await request(app).get(`/api/search`).query({ q: tag, type: "artists" });
    expect(artists.status).toBe(200);
    expect((artists.body.artists as { name: string }[]).some((a) => a.name.includes(tag))).toBe(true);

    const usersRes = await request(app).get(`/api/search`).query({ q: tag, type: "users" });
    expect((usersRes.body.users as { name: string }[]).some((u) => u.name.includes(tag))).toBe(true);

    // Empty query returns the empty faceted shape.
    const empty = await request(app).get(`/api/search`).query({ q: "" });
    expect(empty.body).toEqual({ tracks: [], artists: [], users: [], universities: [] });
  });

  it("finds a university by name", async () => {
    const uni = `Polytechnic of ${rnd()}`;
    await registerVerified({ university: uni });
    const res = await request(app).get(`/api/search`).query({ q: uni, type: "universities" });
    expect((res.body.universities as string[]).some((u) => u === uni)).toBe(true);
  });

  it("serves discovery endpoints with the right shapes", async () => {
    const me = await registerVerified();

    const now = await request(app).get("/api/discovery/now-listening");
    expect(now.status).toBe(200);
    expect(Array.isArray(now.body.items)).toBe(true);

    const trending = await request(app).get("/api/discovery/trending").query({ dimension: "university" });
    expect(trending.status).toBe(200);
    expect(trending.body.dimension).toBe("university");
    expect(Array.isArray(trending.body.groups)).toBe(true);

    const forYou = await request(app).get("/api/discovery/for-you").set(auth(me.token));
    expect(forYou.status).toBe(200);
    expect(Array.isArray(forYou.body.tracks)).toBe(true);

    // For-you requires auth.
    expect((await request(app).get("/api/discovery/for-you")).status).toBe(401);
  });
});
