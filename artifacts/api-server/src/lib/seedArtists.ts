import { db, users } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";

// Seeded artists a1..a10 are real `users` rows (role=artist, is_system=true).
// On the existing DB, migration 0001 backfilled them from the old `artists`
// table; on a fresh DB this runtime seed creates them. Idempotent.
const SEED_ARTISTS = [
  { id: "a1", name: "Campus Collective", genre: "Indie", university: "State University", coverColor: "#e85d4a", avatarUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop&auto=format", bio: "Indie band born in the dorm rooms of State University." },
  { id: "a2", name: "The Studio Band", genre: "Electronic", university: "City College", coverColor: "#3b82f6", avatarUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop&auto=format", bio: "Electronic producers pushing sonic boundaries." },
  { id: "a3", name: "Jazz Ensemble", genre: "Jazz", university: "Music Academy", coverColor: "#8b5cf6", avatarUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200&h=200&fit=crop&auto=format", bio: "Classical jazz reimagined for the modern campus." },
  { id: "a4", name: "Folk Collective", genre: "Folk", university: "Arts University", coverColor: "#f59e0b", avatarUrl: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=200&h=200&fit=crop&auto=format", bio: "Acoustic storytelling from the Arts quad." },
  { id: "a5", name: "R&B Society", genre: "R&B", university: "State University", coverColor: "#10b981", avatarUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=200&h=200&fit=crop&auto=format", bio: "Smooth R&B vibes from a passionate collective." },
  { id: "a6", name: "Lo-Fi Club", genre: "Lo-Fi", university: "Technical Institute", coverColor: "#6366f1", avatarUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop&auto=format", bio: "The perfect soundtrack for studying." },
  { id: "a7", name: "Synth Wave", genre: "Electronic", university: "City College", coverColor: "#ec4899", avatarUrl: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=200&h=200&fit=crop&auto=format", bio: "Synthesizer-driven electronic music." },
  { id: "a8", name: "Singer Songwriters", genre: "Acoustic", university: "Liberal Arts College", coverColor: "#14b8a6", avatarUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=200&h=200&fit=crop&auto=format", bio: "Personal stories through raw acoustic sound." },
  { id: "a9", name: "Hip Hop Collective", genre: "Hip Hop", university: "State University", coverColor: "#f97316", avatarUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&auto=format", bio: "Campus hip hop — authentic, unfiltered." },
  { id: "a10", name: "Ambient Lab", genre: "Ambient", university: "Technical Institute", coverColor: "#0ea5e9", avatarUrl: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=200&h=200&fit=crop&auto=format", bio: "Textural soundscapes for deep focus." },
];

export async function seedArtists(): Promise<void> {
  const ids = SEED_ARTISTS.map((a) => a.id);
  const existing = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
  const existingIds = new Set(existing.map((r) => r.id));
  const missing = SEED_ARTISTS.filter((a) => !existingIds.has(a.id));

  if (missing.length === 0) {
    logger.info("System artist users already seeded, skipping");
    return;
  }

  const toInsert = missing.map((a) => ({
    id: a.id,
    username: a.id,
    email: `seed+${a.id}@campus-music.local`,
    password: "!system-no-login", // sentinel; /auth/login rejects is_system accounts
    name: a.name,
    role: "artist" as const,
    university: a.university,
    country: "",
    avatarUrl: a.avatarUrl,
    bio: a.bio,
    genre: a.genre,
    coverColor: a.coverColor,
    isSystem: true,
  }));

  await db.insert(users).values(toInsert).onConflictDoNothing();
  logger.info({ count: missing.length }, "Seeded system artist users into database");
}
