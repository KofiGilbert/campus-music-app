import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../routes/auth";

// Attach the authenticated user id to the request. Set by requireAuth /
// optionalAuth so route handlers never re-parse the Authorization header.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
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
 * sets `req.userId` and continues.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  const userId = token ? await verifyToken(token) : null;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}

/**
 * Attach `req.userId` when a valid token is present; never rejects. Use on
 * routes whose response varies by auth (e.g. a `following` flag) but that are
 * also reachable signed-out.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  const userId = token ? await verifyToken(token) : null;
  if (userId) req.userId = userId;
  next();
}
