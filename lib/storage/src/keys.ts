// Canonical object-key builders so the API server and the transcoder agree on
// where everything lives. See DEVIN_ROADMAP Phase 2 Decision A.4/A.5.

export const storageKeys = {
  /** Raw client upload, consumed by the transcoder: uploads/{trackId}/{filename} */
  rawUpload: (trackId: string, filename: string): string => `uploads/${trackId}/${filename}`,
  /** Transcoded audio variant: audio/{trackId}/{bitrate}.m4a */
  audio: (trackId: string, bitrate: string): string => `audio/${trackId}/${bitrate}.m4a`,
  /** Cover art variant: covers/{trackId}/{size}.webp */
  cover: (trackId: string, size: string): string => `covers/${trackId}/${size}.webp`,
  /** Separated stem: stems/{trackId}/{stem}.m4a */
  stem: (trackId: string, stem: string): string => `stems/${trackId}/${stem}.m4a`,
  /** Avatar variant (Supabase Storage): avatars/{userId}/{size}.webp */
  avatar: (userId: string, size: string): string => `avatars/${userId}/${size}.webp`,
};
