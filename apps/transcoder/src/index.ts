import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, lt } from "drizzle-orm";
import { db, uploadJobs, tracks, aiJobs } from "@workspace/db";
import { audioStorage, storageKeys } from "@workspace/storage";
import sharp from "sharp";

// Standalone audio-transcoding worker (a separate Fly app, not the API server).
// Polls upload_jobs, runs ffmpeg to produce 96/160/320 kbps AAC, resizes cover
// art with sharp, uploads the variants to R2, and updates the track row.

const execFileAsync = promisify(execFile);

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 3;
const AUDIO_BITRATES = ["96", "160", "320"] as const;
const COVER_SIZES: Record<string, number> = { thumb: 64, medium: 300, full: 1200 };

let shuttingDown = false;

/** Claim the next pending job atomically (FOR UPDATE SKIP LOCKED). */
async function claimNextJob() {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(uploadJobs)
      .where(and(eq(uploadJobs.status, "pending"), lt(uploadJobs.attempts, MAX_ATTEMPTS)))
      .orderBy(uploadJobs.createdAt)
      .limit(1)
      .for("update", { skipLocked: true });
    if (!job) return null;

    await tx
      .update(uploadJobs)
      .set({ status: "processing", attempts: job.attempts + 1, startedAt: new Date() })
      .where(eq(uploadJobs.id, job.id));
    return job;
  });
}

/** ffmpeg: one source -> three AAC variants. Returns the variant key map. */
async function transcodeAudio(trackId: string, sourceKey: string): Promise<Record<string, string>> {
  const work = await mkdtemp(path.join(tmpdir(), `tx-${trackId}-`));
  try {
    const srcPath = path.join(work, "source");
    await writeFile(srcPath, await audioStorage.getBuffer(sourceKey));

    const args = ["-i", srcPath, "-y"];
    const outPaths: Record<string, string> = {};
    for (const bitrate of AUDIO_BITRATES) {
      const out = path.join(work, `${bitrate}.m4a`);
      outPaths[bitrate] = out;
      args.push("-vn", "-c:a", "aac", "-b:a", `${bitrate}k`, out);
    }
    await execFileAsync("ffmpeg", args);

    const keys: Record<string, string> = {};
    for (const bitrate of AUDIO_BITRATES) {
      const key = storageKeys.audio(trackId, bitrate);
      await audioStorage.putBuffer(key, await readFile(outPaths[bitrate]), "audio/mp4");
      keys[bitrate] = key;
    }
    return keys;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** sharp: one cover -> thumb/medium/full WebP. Returns the variant key map. */
async function processCover(trackId: string, coverKey: string): Promise<Record<string, string>> {
  const source = await audioStorage.getBuffer(coverKey);
  const keys: Record<string, string> = {};
  for (const [label, size] of Object.entries(COVER_SIZES)) {
    const webp = await sharp(source).resize(size, size, { fit: "cover" }).webp().toBuffer();
    const key = storageKeys.cover(trackId, label);
    await audioStorage.putBuffer(key, webp, "image/webp");
    keys[label] = key;
  }
  return keys;
}

async function processJob(job: typeof uploadJobs.$inferSelect): Promise<void> {
  console.log(`[transcoder] processing job ${job.id} (track ${job.trackId})`);

  const audioUrls = await transcodeAudio(job.trackId, job.sourceKey);

  // Cover art is optional. The track's coverUrl (set at upload) is the raw key.
  const [track] = await db.select().from(tracks).where(eq(tracks.id, job.trackId)).limit(1);
  let coverUrls: Record<string, string> | null = null;
  if (track?.coverUrl && !track.coverUrl.startsWith("http")) {
    try {
      coverUrls = await processCover(job.trackId, track.coverUrl);
    } catch (err) {
      console.warn(`[transcoder] cover processing failed for ${job.trackId}:`, err);
    }
  }

  await db
    .update(tracks)
    .set({
      audioUrls,
      audioUrl: audioUrls["160"],
      ...(coverUrls ? { coverUrls, coverUrl: coverUrls.medium } : {}),
      processingStatus: "ready",
      updatedAt: new Date(),
    })
    .where(eq(tracks.id, job.trackId));

  await db
    .update(uploadJobs)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(uploadJobs.id, job.id));

  // Bridge to the AI pipeline: queue embedding + stems jobs for the future
  // ai-worker (Phase 12). The transcoder does NOT run these.
  await db.insert(aiJobs).values([
    { type: "embedding", trackId: job.trackId },
    { type: "stems", trackId: job.trackId },
  ]);

  console.log(`[transcoder] completed job ${job.id}`);
}

async function failJob(job: typeof uploadJobs.$inferSelect, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[transcoder] job ${job.id} failed:`, message);
  // Only mark the track failed once we've exhausted retries.
  const exhausted = job.attempts >= MAX_ATTEMPTS;
  await db
    .update(uploadJobs)
    .set({ status: exhausted ? "failed" : "pending", errorMessage: message })
    .where(eq(uploadJobs.id, job.id));
  if (exhausted) {
    await db
      .update(tracks)
      .set({ processingStatus: "failed" })
      .where(eq(tracks.id, job.trackId));
  }
}

async function tick(): Promise<void> {
  const job = await claimNextJob();
  if (!job) return;
  try {
    await processJob(job);
  } catch (err) {
    await failJob(job, err);
  }
}

async function main(): Promise<void> {
  console.log("[transcoder] worker started");
  process.on("SIGTERM", () => {
    console.log("[transcoder] SIGTERM — finishing current job then exiting");
    shuttingDown = true;
  });

  while (!shuttingDown) {
    try {
      await tick();
    } catch (err) {
      console.error("[transcoder] poll error:", err);
    }
    if (shuttingDown) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  console.log("[transcoder] shut down cleanly");
  process.exit(0);
}

void main();
