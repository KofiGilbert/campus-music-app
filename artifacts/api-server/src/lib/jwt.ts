import { SignJWT, jwtVerify } from "jose";
import { logger } from "./logger";

// JWT signing/verification — the single source of truth for token handling.
// Imported by routes/auth.ts (sign) and middlewares/auth.ts (verify); kept out
// of routes so the middleware doesn't create a routes <-> middleware import cycle.

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      logger.error("JWT_SECRET environment variable is required in production");
      process.exit(1);
    }
    logger.warn("JWT_SECRET not set — using insecure dev-only fallback");
    return new TextEncoder().encode("campus-music-dev-secret-change-in-prod");
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();
const JWT_ISSUER = "campus-music";
const JWT_EXPIRY = "30d";

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: JWT_ISSUER });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
