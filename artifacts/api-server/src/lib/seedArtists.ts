import { db, artists, artistFollows } from "@workspace/db";
import { like, and, eq } from "drizzle-orm";
import { logger } from "./logger";

const SEED_ARTISTS = [
  {
    id: "a1",
    name: "Campus Collective",
    genre: "Indie",
    university: "State University",
    coverColor: "#e85d4a",
    avatarUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop&auto=format",
    bio: "Indie band born in the dorm rooms of State University.",
    seedFollowers: 44,
  },
  {
    id: "a2",
    name: "The Studio Band",
    genre: "Electronic",
    university: "City College",
    coverColor: "#3b82f6",
    avatarUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop&auto=format",
    bio: "Electronic producers pushing sonic boundaries.",
    seedFollowers: 32,
  },
  {
    id: "a3",
    name: "Jazz Ensemble",
    genre: "Jazz",
    university: "Music Academy",
    coverColor: "#8b5cf6",
    avatarUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200&h=200&fit=crop&auto=format",
    bio: "Classical jazz reimagined for the modern campus.",
    seedFollowers: 75,
  },
  {
    id: "a4",
    name: "Folk Collective",
    genre: "Folk",
    university: "Arts University",
    coverColor: "#f59e0b",
    avatarUrl: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=200&h=200&fit=crop&auto=format",
    bio: "Acoustic storytelling from the Arts quad.",
    seedFollowers: 24,
  },
  {
    id: "a5",
    name: "R&B Society",
    genre: "R&B",
    university: "State University",
    coverColor: "#10b981",
    avatarUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=200&h=200&fit=crop&auto=format",
    bio: "Smooth R&B vibes from a passionate collective.",
    seedFollowers: 64,
  },
  {
    id: "a6",
    name: "Lo-Fi Club",
    genre: "Lo-Fi",
    university: "Technical Institute",
    coverColor: "#6366f1",
    avatarUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop&auto=format",
    bio: "The perfect soundtrack for studying.",
    seedFollowers: 121,
  },
  {
    id: "a7",
    name: "Synth Wave",
    genre: "Electronic",
    university: "City College",
    coverColor: "#ec4899",
    avatarUrl: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=200&h=200&fit=crop&auto=format",
    bio: "Synthesizer-driven electronic music.",
    seedFollowers: 20,
  },
  {
    id: "a8",
    name: "Singer Songwriters",
    genre: "Acoustic",
    university: "Liberal Arts College",
    coverColor: "#14b8a6",
    avatarUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=200&h=200&fit=crop&auto=format",
    bio: "Personal stories through raw acoustic sound.",
    seedFollowers: 35,
  },
  {
    id: "a9",
    name: "Hip Hop Collective",
    genre: "Hip Hop",
    university: "State University",
    coverColor: "#f97316",
    avatarUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&h=200&fit=crop&auto=format",
    bio: "Campus hip hop — authentic, unfiltered.",
    seedFollowers: 93,
  },
  {
    id: "a10",
    name: "Ambient Lab",
    genre: "Ambient",
    university: "Technical Institute",
    coverColor: "#0ea5e9",
    avatarUrl: "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=200&h=200&fit=crop&auto=format",
    bio: "Textural soundscapes for deep focus.",
    seedFollowers: 150,
  },
];

export async function seedArtists(): Promise<void> {
  const existing = await db.select({ id: artists.id }).from(artists);
  const existingIds = new Set(existing.map((r) => r.id));
  const missing = SEED_ARTISTS.filter((a) => !existingIds.has(a.id));

  if (missing.length > 0) {
    const toInsert = missing.map(({ seedFollowers: _sf, ...rest }) => rest);
    await db.insert(artists).values(toInsert).onConflictDoNothing();
    logger.info({ count: missing.length }, "Seeded missing artists into database");
  } else {
    logger.info("Artists already fully seeded, skipping");
  }

  await seedArtistFollows();
}

async function seedArtistFollows(): Promise<void> {
  const existingSeeded = await db
    .select({ artistId: artistFollows.artistId })
    .from(artistFollows)
    .where(like(artistFollows.userId, "seed_f_%"));

  const alreadySeededArtistIds = new Set(existingSeeded.map((r) => r.artistId));

  const followRows: { userId: string; artistId: string }[] = [];

  for (const artist of SEED_ARTISTS) {
    if (alreadySeededArtistIds.has(artist.id)) continue;
    for (let i = 1; i <= artist.seedFollowers; i++) {
      const paddedIndex = String(i).padStart(3, "0");
      followRows.push({ userId: `seed_f_${paddedIndex}`, artistId: artist.id });
    }
  }

  if (followRows.length === 0) {
    logger.info("Seed artist follows already present for all artists, skipping");
    return;
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < followRows.length; i += BATCH_SIZE) {
    await db.insert(artistFollows).values(followRows.slice(i, i + BATCH_SIZE)).onConflictDoNothing();
  }

  logger.info({ count: followRows.length }, "Seeded artist follows into database");
}
