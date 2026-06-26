import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

// requireAuth rejects before any DB access, so these pass without a database.
describe("requireAuth middleware", () => {
  it("rejects a protected route with no token (401)", async () => {
    const res = await request(app).get("/api/playback");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("rejects a protected route with an invalid token (401)", async () => {
    const res = await request(app)
      .get("/api/playback")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
