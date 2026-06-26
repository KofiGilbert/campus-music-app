import { audioStorage } from "@workspace/storage";

// Tracks store R2 object KEYS (e.g. "audio/{id}/160.m4a") in audioUrl/coverUrl
// and the audioUrls/coverUrls JSON maps. Client-facing URLs are resolved to
// signed read URLs at response time. Legacy rows that still hold a full http(s)
// URL are passed through unchanged.

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

async function signOne(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (isHttpUrl(value)) return value;
  return audioStorage.getSignedReadUrl(value);
}

async function signMap(
  map: Record<string, string> | null | undefined,
): Promise<Record<string, string> | null> {
  if (!map) return null;
  const entries = await Promise.all(
    Object.entries(map).map(async ([k, v]) => [k, (await signOne(v)) ?? v] as const),
  );
  return Object.fromEntries(entries);
}

type TrackMediaFields = {
  audioUrl: string | null;
  coverUrl: string | null;
  audioUrls?: Record<string, string> | null;
  coverUrls?: Record<string, string> | null;
};

/** Resolve a single track's media keys to signed URLs. */
export async function signTrackMedia<T extends TrackMediaFields>(track: T): Promise<T> {
  const [audioUrl, coverUrl, audioUrls, coverUrls] = await Promise.all([
    signOne(track.audioUrl),
    signOne(track.coverUrl),
    "audioUrls" in track ? signMap(track.audioUrls) : Promise.resolve(undefined),
    "coverUrls" in track ? signMap(track.coverUrls) : Promise.resolve(undefined),
  ]);
  return {
    ...track,
    audioUrl,
    coverUrl,
    ...(audioUrls !== undefined ? { audioUrls } : {}),
    ...(coverUrls !== undefined ? { coverUrls } : {}),
  };
}

/** Resolve media keys for a list of tracks. */
export function signTracksMedia<T extends TrackMediaFields>(rows: T[]): Promise<T[]> {
  return Promise.all(rows.map((r) => signTrackMedia(r)));
}
