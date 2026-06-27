import { describe, it, expect, vi, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import request from "supertest";
import app from "../app";
import { db, users } from "@workspace/db";
import { emailService } from "@workspace/email";

const integration = process.env.INTEGRATION === "1";
const uniq = (p: string) => `ci-${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function registerVerified(role: "listener" | "artist" = "listener") {
  const email = uniq(role);
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "supersecret", name: "User", role, university: "U", country: "US" });
  vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined);
  const send = await request(app).post("/api/auth/otp/send").send({ email });
  await request(app).post("/api/auth/otp/verify").send({ email, code: send.body.devCode });
  return { token: reg.body.accessToken as string, userId: reg.body.user.id as string, email };
}

/** Promote a user to admin in the DB and return a fresh admin token via re-login. */
async function makeAdmin(email: string) {
  await db.update(users).set({ isAdmin: true }).where(eq(users.email, email));
  const login = await request(app).post("/api/auth/login").send({ email, password: "supersecret" });
  return login.body.accessToken as string;
}

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe.runIf(integration)("admin + moderation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gates admin endpoints to admins", async () => {
    const nonAdmin = await registerVerified();
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
    expect((await request(app).get("/api/admin/users").set(auth(nonAdmin.token))).status).toBe(403);
  });

  it("lets a user report content and an admin resolve it", async () => {
    const reporter = await registerVerified();
    const adminUser = await registerVerified();
    const adminToken = await makeAdmin(adminUser.email);

    const flagged = await request(app)
      .post("/api/flags")
      .set(auth(reporter.token))
      .send({ targetType: "post", targetId: "some-post-id", reason: "spam" });
    expect(flagged.status).toBe(201);

    const queue = await request(app).get("/api/admin/flags?status=open").set(auth(adminToken));
    const mine = (queue.body.items as { id: string }[]).find((f) => f.id === flagged.body.id);
    expect(mine).toBeTruthy();

    expect(
      (await request(app).post(`/api/admin/flags/${flagged.body.id}/resolve`).set(auth(adminToken)).send({ status: "resolved" }))
        .body.status,
    ).toBe("resolved");
  });

  it("bans a user (blocks login) and serves analytics", async () => {
    const victim = await registerVerified();
    const adminUser = await registerVerified();
    const adminToken = await makeAdmin(adminUser.email);

    await request(app).post(`/api/admin/users/${victim.userId}/ban`).set(auth(adminToken)).send({ banned: true });
    const login = await request(app).post("/api/auth/login").send({ email: victim.email, password: "supersecret" });
    expect(login.status).toBe(403);

    const analytics = await request(app).get("/api/admin/analytics").set(auth(adminToken));
    expect(analytics.status).toBe(200);
    expect(typeof analytics.body.totals.users).toBe("number");
  });
});
