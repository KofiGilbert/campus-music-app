import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { signToken, verifyToken } from "../lib/jwt";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

describe("jwt claims", () => {
  it("round-trips sub/role/isAdmin/isSystem", async () => {
    const token = await signToken({ sub: "u1", role: "artist", isAdmin: true, isSystem: false });
    const claims = await verifyToken(token);
    expect(claims).toEqual({ sub: "u1", role: "artist", isAdmin: true, isSystem: false });
  });

  it("defaults role to listener and isAdmin/isSystem to false for a token minted without those claims", async () => {
    // Forge a token the way a pre-deploy build did — sub only, no role/admin/
    // system claims — and confirm verifyToken fills the safe defaults rather
    // than leaking undefined (an attacker must not gain admin by omitting it).
    const legacyToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("legacy-user")
      .setIssuer("campus-music")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(SECRET);

    const claims = await verifyToken(legacyToken);
    expect(claims).toEqual({
      sub: "legacy-user",
      role: "listener",
      isAdmin: false,
      isSystem: false,
    });
  });

  it("does not treat truthy-but-non-boolean admin/system claims as true", async () => {
    // Strict === true: a forged `isAdmin: 1` (truthy, not boolean) stays false.
    const forged = await new SignJWT({ role: "listener", isAdmin: 1, isSystem: "yes" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("forger")
      .setIssuer("campus-music")
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(SECRET);

    const claims = await verifyToken(forged);
    expect(claims?.isAdmin).toBe(false);
    expect(claims?.isSystem).toBe(false);
  });

  it("returns null for an invalid token", async () => {
    expect(await verifyToken("not-a-jwt")).toBeNull();
  });
});
