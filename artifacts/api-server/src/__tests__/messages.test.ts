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

describe.runIf(integration)("direct messages", () => {
  afterEach(() => vi.restoreAllMocks());

  it("opens a conversation, sends + reads messages, tracks unread", async () => {
    const a = await registerVerified();
    const b = await registerVerified();

    // A opens a DM with B.
    const conv = await request(app).post("/api/conversations").set(auth(a.token)).send({ userId: b.userId });
    expect(conv.status).toBe(201);
    const convId = conv.body.id as string;
    expect(conv.body.participants.some((p: { id: string }) => p.id === b.userId)).toBe(true);

    // Re-opening returns the same conversation (no duplicate).
    const conv2 = await request(app).post("/api/conversations").set(auth(a.token)).send({ userId: b.userId });
    expect(conv2.body.id).toBe(convId);

    // A sends a message.
    const sent = await request(app)
      .post(`/api/conversations/${convId}/messages`)
      .set(auth(a.token))
      .send({ body: "hey there" });
    expect(sent.status).toBe(201);
    expect(sent.body.sender.id).toBe(a.userId);

    // B sees the conversation with unreadCount 1.
    const bList = await request(app).get("/api/conversations").set(auth(b.token));
    const bConv = (bList.body.items as { id: string; unreadCount: number }[]).find((c) => c.id === convId);
    expect(bConv?.unreadCount).toBe(1);

    // B reads it; unread clears.
    expect((await request(app).post(`/api/conversations/${convId}/read`).set(auth(b.token))).status).toBe(200);
    const bList2 = await request(app).get("/api/conversations").set(auth(b.token));
    const bConv2 = (bList2.body.items as { id: string; unreadCount: number }[]).find((c) => c.id === convId);
    expect(bConv2?.unreadCount).toBe(0);

    // B can read the thread.
    const msgs = await request(app).get(`/api/conversations/${convId}/messages`).set(auth(b.token));
    expect(msgs.status).toBe(200);
    expect((msgs.body.items as { body: string }[])[0].body).toBe("hey there");
  });

  it("rejects empty messages and non-participants", async () => {
    const a = await registerVerified();
    const b = await registerVerified();
    const c = await registerVerified();

    const conv = await request(app).post("/api/conversations").set(auth(a.token)).send({ userId: b.userId });
    const convId = conv.body.id as string;

    // Empty message → 400.
    expect(
      (await request(app).post(`/api/conversations/${convId}/messages`).set(auth(a.token)).send({ body: "   " }))
        .status,
    ).toBe(400);

    // Outsider C cannot read or post.
    expect((await request(app).get(`/api/conversations/${convId}/messages`).set(auth(c.token))).status).toBe(403);
    expect(
      (await request(app).post(`/api/conversations/${convId}/messages`).set(auth(c.token)).send({ body: "hi" }))
        .status,
    ).toBe(403);
  });

  it("rejects messaging yourself and unknown users", async () => {
    const a = await registerVerified();
    expect((await request(app).post("/api/conversations").set(auth(a.token)).send({ userId: a.userId })).status).toBe(
      400,
    );
    expect(
      (await request(app).post("/api/conversations").set(auth(a.token)).send({ userId: "does-not-exist" })).status,
    ).toBe(404);
  });

  it("requires auth", async () => {
    expect((await request(app).get("/api/conversations")).status).toBe(401);
  });
});
