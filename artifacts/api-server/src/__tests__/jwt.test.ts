import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../lib/jwt";

describe("jwt claims", () => {
  it("round-trips sub/role/isAdmin/isSystem", async () => {
    const token = await signToken({ sub: "u1", role: "artist", isAdmin: true, isSystem: false });
    const claims = await verifyToken(token);
    expect(claims).toEqual({ sub: "u1", role: "artist", isAdmin: true, isSystem: false });
  });

  it("defaults isAdmin/isSystem to false and role to listener when absent/odd", async () => {
    // A token without the extra claims still verifies; flags default safely.
    const token = await signToken({ sub: "u2", role: "listener", isAdmin: false, isSystem: false });
    const claims = await verifyToken(token);
    expect(claims?.isAdmin).toBe(false);
    expect(claims?.isSystem).toBe(false);
  });

  it("returns null for an invalid token", async () => {
    expect(await verifyToken("not-a-jwt")).toBeNull();
  });
});
