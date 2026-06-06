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

export interface AuthClaims {
  sub: string;
  role: string;
  isAdmin: boolean;
  isSystem: boolean;
}

// NOTE: role/isAdmin/isSystem are baked into the token at sign time (login /
// register). A change to a user's role or admin/system status does NOT take
// effect until they obtain a new token — i.e. re-login, or token rotation when
// refresh tokens land (Phase 2; access-token expiry also drops to ~15min then).
// Acceptable for Phase 0 (admin promotion is a deliberate, infrequent action).
export async function signToken(claims: AuthClaims): Promise<string> {
  return new SignJWT({
    sub: claims.sub,
    role: claims.role,
    isAdmin: claims.isAdmin,
    isSystem: claims.isSystem,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: JWT_ISSUER });
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      role: typeof payload.role === "string" ? payload.role : "listener",
      isAdmin: payload.isAdmin === true,
      isSystem: payload.isSystem === true,
    };
  } catch {
    return null;
  }
}
