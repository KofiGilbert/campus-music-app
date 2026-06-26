import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { verifyToken, type AuthClaims } from "../lib/jwt";

// Attach the authenticated user id + token claims to the request. Set by
// requireAuth / optionalAuth / requireAdmin so handlers never re-parse the
// Authorization header or re-query the DB for role/admin/system.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      auth?: AuthClaims;
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/**
 * Require a valid bearer token. Responds 401 when missing/invalid; otherwise
 * sets `req.userId` + `req.auth` and continues.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  const claims = token ? await verifyToken(token) : null;
  if (!claims) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = claims.sub;
  req.auth = claims;
  next();
}

/**
 * Attach `req.userId` + `req.auth` when a valid token is present; never rejects.
 * Use on routes whose response varies by auth but are reachable signed-out.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  const claims = token ? await verifyToken(token) : null;
  if (claims) {
    req.userId = claims.sub;
    req.auth = claims;
  }
  next();
}

/**
 * Require a valid token whose `isAdmin` claim is true. 401 when unauthenticated,
 * 403 when authenticated but not an admin. Pure token check — no DB round-trip.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  const claims = token ? await verifyToken(token) : null;
  if (!claims) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = claims.sub;
  req.auth = claims;
  if (!claims.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

/**
 * Require the authenticated user to have a verified email. Compose AFTER
 * requireAuth (it reads req.userId). 403s with "Email verification required" for
 * unverified users. Verification status isn't a JWT claim (it flips false->true
 * mid-session and we don't force a re-login for it), so this reads it from the
 * DB — acceptable on the low-QPS write endpoints it guards.
 */
export async function requireVerified(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [row] = await db
    .select({ emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row?.emailVerified) {
    res.status(403).json({ error: "Email verification required" });
    return;
  }
  next();
}
