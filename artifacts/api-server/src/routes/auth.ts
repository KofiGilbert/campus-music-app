import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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

function buildUserResponse(user: {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  university: string | null;
  country: string | null;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
    role: user.role ?? "listener",
    university: user.university ?? "",
    country: user.country ?? "",
    avatarUrl: user.avatarUrl ?? null,
  };
}

async function registerUser(
  req: Parameters<Parameters<typeof router.post>[1]>[0],
  res: Parameters<Parameters<typeof router.post>[1]>[1]
): Promise<void> {
  const { email, password, name, role, university, country } = req.body as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
    role?: unknown;
    university?: unknown;
    country?: unknown;
  };

  if (
    typeof email !== "string" || !email ||
    typeof password !== "string" || password.length < 6 ||
    typeof name !== "string" || !name ||
    typeof role !== "string" || !["listener", "artist"].includes(role) ||
    typeof university !== "string" || !university ||
    typeof country !== "string" || !country
  ) {
    res.status(400).json({ error: "Invalid registration data" });
    return;
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      username: email,
      email,
      password: hashedPassword,
      name,
      role: role as "listener" | "artist",
      university,
      country,
    })
    .returning();

  const token = await signToken(newUser.id);
  req.log.info({ userId: newUser.id }, "User registered");

  res.status(201).json({ token, user: buildUserResponse(newUser) });
}

router.post("/auth/register", async (req, res): Promise<void> => {
  await registerUser(req, res);
});

router.post("/auth/signup", async (req, res): Promise<void> => {
  await registerUser(req, res);
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: unknown; password?: unknown };

  if (typeof email !== "string" || !email || typeof password !== "string" || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = await signToken(user.id);
  req.log.info({ userId: user.id }, "User logged in");

  res.json({ token, user: buildUserResponse(user) });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const userId = await verifyToken(token);

  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(buildUserResponse(user));
});

router.patch("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const userId = await verifyToken(token);

  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const { name, university, country, avatarUrl } = req.body as { name?: unknown; university?: unknown; country?: unknown; avatarUrl?: unknown };

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({ error: "Name must be a non-empty string" });
    return;
  }

  const updates: { name?: string; university?: string; country?: string; avatarUrl?: string | null } = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof university === "string") updates.university = university.trim();
  if (typeof country === "string") updates.country = country.trim();
  if (avatarUrl === null || typeof avatarUrl === "string") updates.avatarUrl = avatarUrl ?? null;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.log.info({ userId }, "User profile updated");
  res.json(buildUserResponse(updated));
});

export default router;
