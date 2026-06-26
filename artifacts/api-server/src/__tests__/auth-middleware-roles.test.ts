import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireAdmin, optionalAuth } from "../middlewares/auth";
import { signToken } from "../lib/jwt";

// Unit-test requireAdmin / optionalAuth directly with mock req/res/next — these
// are pure token checks (no DB), and requireAdmin has no wired route yet (admin
// routes land in Phase 10), so there's nothing to drive via supertest.

function mockReqRes(authHeader?: string) {
  const req = { headers: authHeader ? { authorization: authHeader } : {} } as unknown as Request;
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const next = vi.fn() as unknown as NextFunction;
  return { req, res: res as unknown as Response & typeof res, next };
}

describe("requireAdmin", () => {
  it("401s with no token", async () => {
    const { req, res, next } = mockReqRes();
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s for a valid non-admin token (and still attaches req.auth)", async () => {
    const token = await signToken({ sub: "u1", role: "listener", isAdmin: false, isSystem: false });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    await requireAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.auth?.sub).toBe("u1");
  });

  it("calls next() for a valid admin token", async () => {
    const token = await signToken({ sub: "admin1", role: "listener", isAdmin: true, isSystem: false });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0); // no response written
    expect(req.auth?.isAdmin).toBe(true);
  });
});

describe("optionalAuth", () => {
  it("continues without attaching auth when no token is present", async () => {
    const { req, res, next } = mockReqRes();
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toBeUndefined();
    expect(req.userId).toBeUndefined();
  });

  it("continues without attaching auth for an invalid token (never rejects)", async () => {
    const { req, res, next } = mockReqRes("Bearer not-a-real-token");
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toBeUndefined();
  });

  it("attaches req.userId + req.auth for a valid token", async () => {
    const token = await signToken({ sub: "u2", role: "artist", isAdmin: false, isSystem: false });
    const { req, res, next } = mockReqRes(`Bearer ${token}`);
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe("u2");
    expect(req.auth?.role).toBe("artist");
  });
});
