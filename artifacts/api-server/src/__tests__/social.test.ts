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

describe.runIf(integration)("social: posts + feed", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates, fetches, lists in feed/user-posts, and soft-deletes a post", async () => {
    const { token, userId } = await registerVerified();

    const created = await request(app).post("/api/posts").set(auth(token)).send({ body: "hello #campus @nobody" });
    expect(created.status).toBe(201);
    expect(created.body.author.id).toBe(userId);
    expect(created.body.likeCount).toBe(0);
    expect(created.body.hasLiked).toBe(false);
    const postId = created.body.id as string;

    const single = await request(app).get(`/api/posts/${postId}`).set(auth(token));
    expect(single.status).toBe(200);
    expect(single.body.id).toBe(postId);

    const feed = await request(app).get("/api/feed").set(auth(token));
    expect(feed.status).toBe(200);
    expect((feed.body.items as { id: string }[]).some((p) => p.id === postId)).toBe(true);

    const userPosts = await request(app).get(`/api/users/${userId}/posts`).set(auth(token));
    expect((userPosts.body.items as { id: string }[]).some((p) => p.id === postId)).toBe(true);

    expect((await request(app).delete(`/api/posts/${postId}`).set(auth(token))).status).toBe(204);
    expect((await request(app).get(`/api/posts/${postId}`)).status).toBe(404);
  });

  it("rejects an empty post and another user's delete", async () => {
    const a = await registerVerified();
    const b = await registerVerified();
    expect((await request(app).post("/api/posts").set(auth(a.token)).send({ body: "  " })).status).toBe(400);
    const p = await request(app).post("/api/posts").set(auth(a.token)).send({ body: "mine" });
    expect((await request(app).delete(`/api/posts/${p.body.id}`).set(auth(b.token))).status).toBe(403);
  });
});

describe.runIf(integration)("social: likes, comments, shares, reposts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("toggles a post like", async () => {
    const { token } = await registerVerified();
    const p = await request(app).post("/api/posts").set(auth(token)).send({ body: "like me" });
    const id = p.body.id as string;
    const on = await request(app).post(`/api/posts/${id}/like`).set(auth(token));
    expect(on.body).toEqual({ liked: true, likeCount: 1 });
    const off = await request(app).post(`/api/posts/${id}/like`).set(auth(token));
    expect(off.body).toEqual({ liked: false, likeCount: 0 });
  });

  it("comments, replies (one level), and likes comments", async () => {
    const { token } = await registerVerified();
    const p = await request(app).post("/api/posts").set(auth(token)).send({ body: "discuss" });
    const postId = p.body.id as string;

    const c = await request(app)
      .post("/api/comments")
      .set(auth(token))
      .send({ targetType: "post", targetId: postId, body: "top comment" });
    expect(c.status).toBe(201);
    const commentId = c.body.id as string;

    const reply = await request(app)
      .post("/api/comments")
      .set(auth(token))
      .send({ body: "a reply", parentCommentId: commentId });
    expect(reply.status).toBe(201);
    // A reply to a reply is rejected (one level only).
    expect(
      (await request(app).post("/api/comments").set(auth(token)).send({ body: "nope", parentCommentId: reply.body.id }))
        .status,
    ).toBe(400);

    const list = await request(app).get(`/api/comments?targetType=post&targetId=${postId}`).set(auth(token));
    expect(list.status).toBe(200);
    const top = (list.body.items as { id: string; replyCount: number; replies: unknown[] }[]).find(
      (x) => x.id === commentId,
    );
    expect(top?.replyCount).toBe(1);
    expect(top?.replies.length).toBe(1);

    const liked = await request(app).post(`/api/comments/${commentId}/like`).set(auth(token));
    expect(liked.body).toEqual({ liked: true, likeCount: 1 });
  });

  it("shares + reposts (with duplicate guard + unrepost)", async () => {
    const author = await registerVerified();
    const p = await request(app).post("/api/posts").set(auth(author.token)).send({ body: "share me" });
    const id = p.body.id as string;

    const sharer = await registerVerified();
    const share = await request(app).post(`/api/posts/${id}/share`).set(auth(sharer.token)).send({ platform: "copy_link" });
    expect(share.body.shareCount).toBe(1);
    expect(share.body.deepLink).toBe(`/post/${id}`);

    const repost = await request(app).post(`/api/posts/${id}/repost`).set(auth(sharer.token));
    expect(repost.status).toBe(201);
    expect(repost.body.type).toBe("repost");
    expect(repost.body.originalPost.id).toBe(id);
    // Duplicate repost -> 409.
    expect((await request(app).post(`/api/posts/${id}/repost`).set(auth(sharer.token))).status).toBe(409);
    // Unrepost.
    expect((await request(app).delete(`/api/posts/${id}/unrepost`).set(auth(sharer.token))).status).toBe(204);
  });
});
