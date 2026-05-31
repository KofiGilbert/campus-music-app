import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTracks, getLikedTrackIds, getLibraryTrackIds, likeTrack, saveToLibrary, getPlaybackState, savePlaybackState, recordPlay } from "@workspace/api-client-react";
import { Track } from "@/components/MusicCard";
import { useAuth } from "@/context/AuthContext";
import { FrequencyAnalyzer, FrequencyBands } from "@/utils/frequencyAnalyzer";

const log = (...args: unknown[]) => {
  if (__DEV__) console.log("[PlayerContext]", ...args);
};

const LIKED_KEY = "campus_music_liked";
const LIBRARY_KEY = "campus_music_library";

const playbackKey = (userId: string | null | undefined) =>
  userId ? `campus_music_playback_${userId}` : "campus_music_playback";
const queueKey = (userId: string | null | undefined) =>
  userId ? `campus_music_queue_${userId}` : "campus_music_queue";
const shuffleKey = (userId: string | null | undefined) =>
  userId ? `campus_music_shuffle_${userId}` : "campus_music_shuffle";
const originalQueueKey = (userId: string | null | undefined) =>
  userId ? `campus_music_original_queue_${userId}` : "campus_music_original_queue";

export const GENRES = ["All", "Indie", "Electronic", "Jazz", "Folk", "R&B", "Lo-Fi", "Hip Hop", "Ambient", "Acoustic", "Synth"];

const FALLBACK_TRACKS: Track[] = [
  { id: "t1", title: "Golden Hour", artist: "Campus Collective", genre: "Indie", duration: "3:42", coverColor: "#e85d4a", liked: false, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "t2", title: "Night Drive", artist: "The Studio Band", genre: "Electronic", duration: "4:15", coverColor: "#3b82f6", liked: false, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: "t3", title: "Rooftop Sessions", artist: "Jazz Ensemble", genre: "Jazz", duration: "5:30", coverColor: "#8b5cf6", liked: false, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: "t4", title: "Sunrise Acoustic", artist: "Folk Collective", genre: "Folk", duration: "3:18", coverColor: "#f59e0b", liked: false, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  { id: "t5", title: "Campus Groove", artist: "R&B Society", genre: "R&B", duration: "3:55", coverColor: "#10b981", liked: false, audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
];

export interface CrossDeviceResumePrompt {
  trackId: string;
  position: number;
  trackTitle: string;
  artist: string;
}

interface PlayerContextType {
  tracks: Track[];
  isLoadingTracks: boolean;
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  duration: number;
  /** Normalized audio level 0–1 from real-time metering. null when metering is unavailable. */
  audioLevel: number | null;
  /**
   * Normalized per-band energy [0–1] for 5 frequency bands (sub-bass → treble).
   * null when frequency analysis is unavailable (falls back to audioLevel).
   */
  frequencyBands: FrequencyBands | null;
  likedIds: Set<string>;
  libraryIds: Set<string>;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  /** Insert a track immediately after the currently playing song in the queue. */
  playNext: (track: Track) => void;
  /** Append a track to the end of the queue. */
  addToQueue: (track: Track) => void;
  /** Whether shuffle mode is active. */
  isShuffled: boolean;
  /** Toggle shuffle on/off. Shuffles or restores the queue in place. */
  toggleShuffle: () => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seekTo: (position: number) => Promise<void>;
  toggleLike: (id: string) => void;
  addToLibrary: (id: string) => void;
  removeFromLibrary: (id: string) => void;
  likedTracks: Track[];
  libraryTracks: Track[];
  /** Non-null when a cross-device resume prompt should be shown to the user. */
  crossDeviceResume: CrossDeviceResumePrompt | null;
  /** User tapped "Resume" — seek to the saved position and start playing. */
  confirmCrossDeviceResume: () => Promise<void>;
  /** User tapped "Dismiss" — clear the prompt and fall back to local state if available. */
  dismissCrossDeviceResume: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const { token, user } = useAuth();
  const userId = user?.id ?? null;
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  const isAuthenticated = !!token;
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  // Track the previous token value so we can detect sign-out vs sign-in/switch.
  // Initialized to a sentinel (undefined) so the initial mount is skipped.
  const prevTokenRef = useRef<string | null | undefined>(undefined);
  // Track the previous userId so we know which scoped keys to delete on sign-out.
  // Mirrors the prevTokenRef sentinel pattern.
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  // Tracks whether liked/library AsyncStorage rehydration has run on the initial
  // app load. Only ever done once to avoid racing against the async multiRemove
  // called during sign-out.
  const likedLibraryLoadedRef = useRef(false);
  // Tracks which userId's playback/queue we last loaded from AsyncStorage.
  // undefined = never loaded; null = loaded for unauthenticated; "id" = that user.
  // Allows re-loading when a different user signs in without re-loading on sign-out.
  const loadedForUserIdRef = useRef<string | null | undefined>(undefined);

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [libraryIds, setLibraryIds] = useState<Set<string>>(new Set());
  const [likeDeltas, setLikeDeltas] = useState<Record<string, number>>({});
  const [playCountDeltas, setPlayCountDeltas] = useState<Record<string, number>>({});
  // Stable ref that always mirrors likedIds — lets toggleLike read current state
  // synchronously without creating a new closure every time likedIds changes.
  const likedIdsRef = useRef<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  // Stable ref that always mirrors the latest progress value so the AppState
  // background-flush callback can read the current position without stale closures.
  const progressRef = useRef(0);
  // Stable ref that always mirrors isPlaying — used by the AppState flush so it
  // can skip saving when the track is paused (no stale closure on the state value).
  const isPlayingRef = useRef(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState<number | null>(null);
  const [frequencyBands, setFrequencyBands] = useState<FrequencyBands | null>(null);
  // Refs used to throttle state updates from the PCM callback
  const lastAudioLevelUpdateRef = useRef(0);
  const smoothedRmsRef = useRef(0);
  const analyzerRef = useRef<FrequencyAnalyzer | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);

  // Stable refs to avoid stale closures in playback status callbacks
  const rawTracksRef = useRef<Track[]>([]);
  const currentTrackRef = useRef<Track | null>(null);

  // Saved playback state loaded from AsyncStorage (track id + position in seconds)
  const [savedPlayback, setSavedPlayback] = useState<{ trackId: string; position: number } | null>(null);
  // Prevent restoring more than once
  const hasRestoredRef = useRef(false);
  // Cross-device restore prompt: set when server state differs from local state
  const [crossDeviceResume, setCrossDeviceResume] = useState<CrossDeviceResumePrompt | null>(null);
  // Stable ref so confirm/dismiss callbacks can read current prompt without stale closures
  const crossDeviceResumeRef = useRef<CrossDeviceResumePrompt | null>(null);
  crossDeviceResumeRef.current = crossDeviceResume;
  // Intermediate state: server data waiting for tracks to load before we can show the prompt
  const [pendingCrossDeviceResume, setPendingCrossDeviceResume] = useState<{ trackId: string; position: number } | null>(null);
  // Position (seconds) to seek to when playTrackInternal loads the matching restored track
  const restoredPositionRef = useRef<{ trackId: string; position: number } | null>(null);
  // Timestamp of last AsyncStorage write — used to throttle frequent status-update writes
  const lastPlaybackSaveRef = useRef(0);
  // Timestamp of last server playback save — throttled separately to avoid spamming the API
  const lastServerPlaybackSaveRef = useRef(0);
  // Whether a play has already been recorded for the current track load.
  // Reset to false each time a new track begins loading so we never double-count.
  const playRecordedRef = useRef(false);
  // Accumulated seconds the user has actively listened (isPlaying ticks) for the
  // current track load. Incremented by the delta between consecutive status-update
  // callbacks while isPlaying is true. Reset on each new track load.
  // Using listened time (not absolute position) avoids counting seeks or restores.
  const accumulatedListeningSecsRef = useRef(0);
  // Timestamp (ms) of the most recent status-update tick while isPlaying was true.
  // Set to null when playback pauses so gap time is never added to the accumulator.
  const lastPlaybackTickRef = useRef<number | null>(null);
  // Ordered list of track IDs representing the current queue (persisted to AsyncStorage)
  const queueRef = useRef<string[]>([]);
  // Saved queue IDs loaded from AsyncStorage, applied once tracks are available
  const [savedQueue, setSavedQueue] = useState<string[] | null>(null);
  // Whether shuffle mode is active
  const [isShuffled, setIsShuffled] = useState(false);
  // Original (pre-shuffle) queue order so we can restore it when shuffle is toggled off
  const originalQueueRef = useRef<string[]>([]);

  // Fetch tracks from the API
  const { data: apiTracksRaw, isLoading: isLoadingTracks, dataUpdatedAt: tracksUpdatedAt } = useQuery({
    queryKey: ["tracks"],
    queryFn: () => getTracks(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Fetch liked track IDs from the server when authenticated.
  // token is included in the key so each user session gets an isolated cache
  // entry — switching accounts never serves the previous user's cached data.
  const { data: serverLikedIds } = useQuery({
    queryKey: ["tracks", "liked", token],
    queryFn: () => getLikedTrackIds(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    retry: 1,
  });

  // Fetch library track IDs from the server when authenticated.
  // token is included in the key so each user session gets an isolated cache entry.
  const { data: serverLibraryIds } = useQuery({
    queryKey: ["tracks", "library", token],
    queryFn: () => getLibraryTrackIds(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    retry: 1,
  });

  // Fetch server-persisted playback state when authenticated (cross-device resume).
  // token is included in the key so different user sessions never share the cached result.
  // retry:0 so failure falls back to AsyncStorage quickly rather than delaying restore.
  const { data: serverPlaybackState, isFetched: serverPlaybackFetched } = useQuery({
    queryKey: ["playback", token],
    queryFn: () => getPlaybackState(),
    enabled: isAuthenticated,
    staleTime: Infinity,
    retry: 0,
  });

  // When authenticated, local AsyncStorage playback is held here as backup until the
  // server query settles. Using state (not a ref) ensures the restore effect re-runs
  // when local loading completes, even if the server query settled first.
  const [localPlaybackLoaded, setLocalPlaybackLoaded] = useState(false);
  const localPlaybackBackupRef = useRef<{ trackId: string; position: number } | null>(null);

  // Keep likedIdsRef in sync with likedIds state so toggleLike can read the
  // current value synchronously without needing likedIds in its dependency array.
  likedIdsRef.current = likedIds;

  // When the tracks query delivers fresh data from the server, the returned like
  // and play counts are authoritative — any pending local deltas are now baked in.
  // Reset them so counts don't drift over time. tracksUpdatedAt changes only when
  // React Query actually fetches new data (not on stale reads).
  useEffect(() => {
    if (tracksUpdatedAt) {
      setLikeDeltas({});
      setPlayCountDeltas({});
    }
  }, [tracksUpdatedAt]);

  // React to auth token changes: clear local state and clean up the previous
  // session's cache entries so stale liked/library data never bleeds across
  // sign-out or account switches.
  //
  // Because liked/library queries are now token-scoped (key includes token),
  // each user session has its own isolated cache entry. When the token changes:
  //  - Sign-out:  reset state + clear AsyncStorage + remove the old token's
  //               cache entries so no stale observer can re-populate state.
  //  - Sign-in / switch: reset state immediately (UI shows empty while loading)
  //               + remove the previous token's cache entries to free memory.
  //               The new token's queries are enabled and have no cached data,
  //               so React Query fetches them automatically — no invalidation
  //               needed.
  useEffect(() => {
    const prevToken = prevTokenRef.current;
    prevTokenRef.current = token;
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    // Skip the initial mount — prevToken starts as undefined (sentinel).
    if (prevToken === undefined) return;

    // Always reset local state so the UI is clean during any auth transition.
    setLikedIds(new Set());
    likedIdsRef.current = new Set();
    setLibraryIds(new Set());

    if (token === null) {
      // User signed out — stop playback, clear track/queue, and wipe AsyncStorage caches.
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
      setCurrentTrack(null);
      currentTrackRef.current = null;
      setIsPlaying(false);
      isPlayingRef.current = false;
      setProgress(0);
      progressRef.current = 0;
      queueRef.current = [];
      // Clear restore intermediates so the restore effects cannot repopulate
      // currentTrack from a previous session's savedPlayback/savedQueue.
      setSavedPlayback(null);
      setSavedQueue(null);
      localPlaybackBackupRef.current = null;
      restoredPositionRef.current = null;
      setCrossDeviceResume(null);
      setPendingCrossDeviceResume(null);
      // Reset so the next sign-in can restore from its own session's storage.
      hasRestoredRef.current = false;
      // Reset localPlaybackLoaded so the server-settle effect re-gates on next sign-in.
      setLocalPlaybackLoaded(false);
      // Clear only the signed-out user's scoped playback keys so that other
      // accounts' saved state on this device remains intact.
      const prevUid = typeof prevUserId === "string" ? prevUserId : null;
      AsyncStorage.multiRemove([
        LIKED_KEY,
        LIBRARY_KEY,
        playbackKey(prevUid),
        queueKey(prevUid),
        shuffleKey(prevUid),
        originalQueueKey(prevUid),
      ]).catch(() => {});
      log("Signed out — cleared playback, track, queue, liked/library state and AsyncStorage caches for user:", prevUid);
    } else {
      log("Token changed — reset liked/library state, new queries will fetch");
    }

    // Remove the previous session's token-scoped cache entries.
    // These have no active observers after the token changed, so removeQueries
    // is reliable and cancels any lingering in-flight request for prevToken.
    if (prevToken) {
      queryClient.removeQueries({ queryKey: ["tracks", "liked", prevToken] });
      queryClient.removeQueries({ queryKey: ["tracks", "library", prevToken] });
    }
  }, [token, queryClient]);

  // Sync liked IDs from server when available. Guard on isAuthenticated so a
  // response that arrives after sign-out cannot re-populate stale liked IDs.
  useEffect(() => {
    if (!serverLikedIds || !isAuthenticated) return;
    const ids = new Set(serverLikedIds);
    setLikedIds(ids);
    likedIdsRef.current = ids;
    // Keep local cache in sync
    AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...ids])).catch(() => {});
    log("Loaded liked IDs from server:", ids.size);
  }, [serverLikedIds, isAuthenticated]);

  // Sync library IDs from server when available. Guard on isAuthenticated so a
  // response that arrives after sign-out cannot re-populate stale library IDs.
  useEffect(() => {
    if (!serverLibraryIds || !isAuthenticated) return;
    const ids = new Set(serverLibraryIds);
    setLibraryIds(ids);
    AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify([...ids])).catch(() => {});
    log("Loaded library IDs from server:", ids.size);
  }, [serverLibraryIds, isAuthenticated]);

  // Map API tracks to the Track type used by components
  const apiTracks: Track[] = (apiTracksRaw ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    genre: t.genre,
    duration: t.duration,
    coverColor: t.coverColor,
    liked: likedIds.has(t.id),
    audioUrl: t.audioUrl ?? undefined,
    coverUrl: t.coverUrl ?? undefined,
    university: t.university ?? undefined,
    playCount: Math.max(0, (t.playCount ?? 0) + (playCountDeltas[t.id] ?? 0)),
    durationSeconds: t.durationSeconds,
    likes: Math.max(0, (t.likes ?? 0) + (likeDeltas[t.id] ?? 0)),
  }));

  const rawTracks: Track[] = apiTracks.length > 0 ? apiTracks : FALLBACK_TRACKS;

  // Keep ref in sync so status callbacks always have the latest list
  rawTracksRef.current = rawTracks;

  // Load persisted likes/library/playback/queue from AsyncStorage.
  // When authenticated, the PLAYBACK_KEY value is held in localPlaybackBackupRef rather than
  // applied to state immediately — the server query must settle first to be authoritative.
  // When unauthenticated, playback is applied directly (no server to wait for).
  //
  // Scoping: playback/queue keys are namespaced by userId so each account's state is
  // independent. likedLibraryLoadedRef ensures liked/library are only read once (on first
  // boot) to avoid racing against the sign-out async cleanup. loadedForUserIdRef tracks
  // which user's playback state we last loaded so we re-read when a different user signs in.
  useEffect(() => {
    // When authenticated, defer until userId is available — the token may be set
    // before the user object resolves (initial boot), so we need the real ID to pick
    // the correct scoped key.
    if (isAuthenticated && !userId) return;

    (async () => {
      try {
        // Liked/library: only ever loaded on the very first app boot. On sign-out
        // the token-change effect already reset state and is asynchronously removing
        // those keys — re-reading here would race against the removal.
        if (!likedLibraryLoadedRef.current) {
          likedLibraryLoadedRef.current = true;
          if (!isAuthenticated) {
            const liked = await AsyncStorage.getItem(LIKED_KEY);
            if (liked) setLikedIds(new Set(JSON.parse(liked)));
            const lib = await AsyncStorage.getItem(LIBRARY_KEY);
            if (lib) setLibraryIds(new Set(JSON.parse(lib)));
          }
        }

        // Playback/queue: load for each distinct user (or once for unauthenticated).
        // Using scoped keys ensures user A's saved state is never visible to user B.
        const targetId = isAuthenticated ? userId : null;
        if (loadedForUserIdRef.current !== targetId) {
          loadedForUserIdRef.current = targetId;

          const pb = await AsyncStorage.getItem(playbackKey(userId));
          if (pb) {
            const parsed = JSON.parse(pb);
            if (parsed && typeof parsed.trackId === "string" && typeof parsed.position === "number" && parsed.position >= 0) {
              if (isAuthenticated) {
                // Hold locally — server result will decide which wins.
                localPlaybackBackupRef.current = parsed;
              } else {
                setSavedPlayback(parsed);
              }
            } else {
              AsyncStorage.removeItem(playbackKey(userId)).catch(() => {});
            }
          }
          const q = await AsyncStorage.getItem(queueKey(userId));
          if (q) {
            const parsed = JSON.parse(q);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((id) => typeof id === "string")) {
              setSavedQueue(parsed);
            } else {
              AsyncStorage.removeItem(queueKey(userId)).catch(() => {});
            }
          }
          const shuffleVal = await AsyncStorage.getItem(shuffleKey(userId));
          if (shuffleVal === "1") {
            setIsShuffled(true);
            const oq = await AsyncStorage.getItem(originalQueueKey(userId));
            if (oq) {
              const parsed = JSON.parse(oq);
              if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
                originalQueueRef.current = parsed;
              }
            }
          }
        }
      } catch {
        // Ignore storage errors — restore will proceed with whatever data is available
      } finally {
        if (isAuthenticated) {
          // Signal local loading complete so the server-settle effect can make its
          // final restore decision, even if storage access threw an error or if
          // this user's data was already loaded (loadedForUserIdRef guard skipped read).
          setLocalPlaybackLoaded(true);
        }
      }
    })();
  }, [isAuthenticated, userId]);

  // Once both the server playback query AND local AsyncStorage have finished loading,
  // decide which source to use. Server data takes priority; if server has nothing or
  // fails, fall back to the AsyncStorage backup. Gating on both localPlaybackLoaded
  // and serverPlaybackFetched guarantees a deterministic result regardless of order.
  //
  // Cross-device detection: if the server track differs from the local track (or there
  // is no local track), this indicates the user last played on a different device.
  // In that case we surface a visible prompt rather than silently restoring.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!serverPlaybackFetched) return;
    if (!localPlaybackLoaded) return;
    if (hasRestoredRef.current) return;

    const sd = serverPlaybackState;
    if (sd && typeof sd.trackId === "string" && sd.trackId.length > 0 && typeof sd.position === "number" && sd.position >= 0) {
      const local = localPlaybackBackupRef.current;
      // Cross-device when: no local state, different track, OR same track but
      // position diverged by more than 10 seconds (listened further on another device).
      const POSITION_TOLERANCE_S = 10;
      const isCrossDevice =
        !local ||
        local.trackId !== sd.trackId ||
        Math.abs(local.position - sd.position) > POSITION_TOLERANCE_S;
      if (isCrossDevice) {
        log("Cross-device restore detected:", sd.trackId, "at", sd.position, "s");
        // Block the silent auto-restore path; user will confirm or dismiss.
        hasRestoredRef.current = true;
        setPendingCrossDeviceResume({ trackId: sd.trackId, position: sd.position });
      } else {
        log("Same-device restore:", sd.trackId, "at", sd.position, "s");
        setSavedPlayback({ trackId: sd.trackId, position: sd.position });
        AsyncStorage.setItem(playbackKey(userId), JSON.stringify({ trackId: sd.trackId, position: sd.position })).catch(() => {});
      }
    } else if (localPlaybackBackupRef.current) {
      log("Server has no playback state, falling back to local:", localPlaybackBackupRef.current.trackId);
      setSavedPlayback(localPlaybackBackupRef.current);
    }
  }, [isAuthenticated, serverPlaybackFetched, serverPlaybackState, localPlaybackLoaded]);

  // Once tracks are available, resolve the pending cross-device state into a full
  // prompt that the UI can display (needs track title and artist name).
  useEffect(() => {
    if (!pendingCrossDeviceResume) return;
    if (rawTracks.length === 0 || isLoadingTracks) return;
    const track = rawTracks.find((t) => t.id === pendingCrossDeviceResume.trackId);
    if (!track) {
      // Track no longer exists — fall back to local state if available.
      setPendingCrossDeviceResume(null);
      const local = localPlaybackBackupRef.current;
      if (local) {
        hasRestoredRef.current = false;
        setSavedPlayback(local);
      }
      return;
    }
    setPendingCrossDeviceResume(null);
    setCrossDeviceResume({
      trackId: pendingCrossDeviceResume.trackId,
      position: pendingCrossDeviceResume.position,
      trackTitle: track.title,
      artist: track.artist,
    });
  }, [rawTracks, pendingCrossDeviceResume, isLoadingTracks]);

  // Restore last-played track and position once tracks are available (no auto-play).
  // Guard on token so a cleared savedPlayback race cannot restore the previous
  // session's track after sign-out.
  useEffect(() => {
    if (token === null) return;
    if (hasRestoredRef.current) return;
    if (!savedPlayback || rawTracks.length === 0) return;
    const track = rawTracks.find((t) => t.id === savedPlayback.trackId);
    if (!track) {
      if (isLoadingTracks) return;
      AsyncStorage.removeItem(playbackKey(userIdRef.current)).catch(() => {});
      AsyncStorage.removeItem(queueKey(userIdRef.current)).catch(() => {});
      hasRestoredRef.current = true;
      setSavedPlayback(null);
      setSavedQueue(null);
      return;
    }
    hasRestoredRef.current = true;
    restoredPositionRef.current = { trackId: savedPlayback.trackId, position: savedPlayback.position };
    setCurrentTrack(track);
    currentTrackRef.current = track;
    setProgress(savedPlayback.position);
    setSavedPlayback(null);
    log("Restored playback position for track:", track.id, "at", savedPlayback.position, "s");
  }, [rawTracks, savedPlayback, isLoadingTracks, token]);

  // When rawTracks updates (API data replaces fallback tracks), refresh currentTrack so
  // fields like coverUrl are never stale. This fixes the case where a restored track came
  // from FALLBACK_TRACKS (no coverUrl) before the API finished loading.
  useEffect(() => {
    setCurrentTrack((prev) => {
      if (!prev) return prev;
      const fresh = rawTracks.find((t) => t.id === prev.id);
      if (!fresh) return prev;
      if (fresh.coverUrl === prev.coverUrl && fresh.playCount === prev.playCount) return prev;
      return { ...prev, coverUrl: fresh.coverUrl, playCount: fresh.playCount };
    });
  }, [rawTracks]);

  // Restore saved queue once tracks are definitively loaded — filter to IDs that still exist.
  // Mirror the playback restore pattern: if tracks haven't loaded from the API yet (only
  // fallback tracks are present), defer and wait rather than wiping a valid saved queue.
  // Guard on token so a stale in-flight storage read cannot restore the previous session's
  // queue after sign-out (matches the same guard in the savedPlayback restore effect).
  useEffect(() => {
    if (token === null) return;
    if (!savedQueue || rawTracks.length === 0) return;
    const trackIds = new Set(rawTracks.map((t) => t.id));
    const validQueue = savedQueue.filter((id) => trackIds.has(id));
    if (validQueue.length > 0) {
      queueRef.current = validQueue;
      log("Restored queue:", validQueue.length, "tracks");
      setSavedQueue(null);
    } else {
      // If the API is still loading, the track list may only contain fallback IDs
      // that won't match the persisted real API IDs. Defer — do not wipe yet.
      if (isLoadingTracks) return;
      // API is done loading and no valid IDs remain — the tracks are gone; clear storage.
      AsyncStorage.removeItem(queueKey(userIdRef.current)).catch(() => {});
      setSavedQueue(null);
    }
  }, [rawTracks, savedQueue, isLoadingTracks, token]);

  // Keep progressRef in sync with progress state so AppState and other
  // callbacks can always read the latest position without stale closures.
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Keep isPlayingRef in sync with isPlaying state so the AppState flush
  // can skip saves when the track is paused, without stale closures.
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Configure audio session on native
  useEffect(() => {
    if (Platform.OS !== "web") {
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      }).catch((err) => log("setAudioMode error:", err));
    }
    return () => {
      soundRef.current?.unloadAsync().catch((err) => log("unload error on cleanup:", err));
    };
  }, []);

  // Flush playback position to AsyncStorage (and the server when authenticated)
  // the moment the app transitions from active → background or inactive.
  // This prevents up-to-30-seconds of progress loss if the user backgrounds
  // or force-quits the app without pausing.
  useEffect(() => {
    let lastAppState: AppStateStatus = AppState.currentState;

    const subscription = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      const goingToBackground =
        lastAppState === "active" &&
        (nextState === "background" || nextState === "inactive");
      lastAppState = nextState;

      if (!goingToBackground) return;

      const track = currentTrackRef.current;
      if (!track) return;

      // Try to get the freshest position and playing state directly from the
      // sound object. Fall back to the ref-mirrored state values if the query fails.
      let position = progressRef.current;
      let playing = isPlayingRef.current;
      try {
        const status = soundRef.current ? await soundRef.current.getStatusAsync() : null;
        if (status && status.isLoaded) {
          position = status.positionMillis / 1000;
          playing = status.isPlaying;
        }
      } catch {
        // Use progressRef / isPlayingRef fallbacks
      }

      // Skip if nothing is actively playing — a pause/seek already wrote the state
      if (!playing) return;

      // Skip if nothing meaningful has played yet
      if (position <= 0) return;

      const trackId = track.id;
      log("App backgrounded — flushing playback position:", trackId, "at", position, "s");

      AsyncStorage.setItem(playbackKey(userIdRef.current), JSON.stringify({ trackId, position })).catch(() => {});
      lastPlaybackSaveRef.current = Date.now();

      if (isAuthenticatedRef.current) {
        lastServerPlaybackSaveRef.current = Date.now();
        savePlaybackState({ trackId, position }).catch((err) => {
          log("savePlaybackState (background flush) error:", err);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Resolve a track by ID from the raw track list
  const getTrackById = useCallback((id: string): Track | undefined => {
    return rawTracksRef.current.find((t) => t.id === id);
  }, []);

  // Auto-advance to the next track when the current one finishes
  const advanceToNext = useCallback(() => {
    const current = currentTrackRef.current;
    const queue = queueRef.current;
    if (queue.length > 0) {
      const idx = current ? queue.indexOf(current.id) : -1;
      const nextId = queue[(idx + 1) % queue.length];
      const next = getTrackById(nextId);
      if (next) { playTrackInternal(next); return; }
    }
    // Fallback: use raw track list order
    const tracks = rawTracksRef.current;
    if (!tracks.length) return;
    const idx = tracks.findIndex((t) => t.id === current?.id);
    const next = tracks[(idx + 1) % tracks.length];
    playTrackInternal(next);
  }, [getTrackById]);

  const playTrackInternal = useCallback(async (track: Track, snapshotQueue?: boolean) => {
    try {
      if (soundRef.current) {
        try { soundRef.current.setOnAudioSampleReceived(null); } catch {}
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setAudioLevel(null);
      setFrequencyBands(null);
      smoothedRmsRef.current = 0;
      if (analyzerRef.current) {
        analyzerRef.current.reset();
      }

      // When a user explicitly picks a track, snapshot the current raw track order
      // as the active queue and persist it so next/prev work correctly after restart.
      if (snapshotQueue) {
        const ids = rawTracksRef.current.map((t) => t.id);
        queueRef.current = ids;
        AsyncStorage.setItem(queueKey(userIdRef.current), JSON.stringify(ids)).catch(() => {});
        log("Queue snapshotted:", ids.length, "tracks");
      }

      const restored = restoredPositionRef.current;
      const startPositionSecs = restored && restored.trackId === track.id ? restored.position : 0;
      restoredPositionRef.current = null;

      // Reset play-count tracking so each new track load starts fresh.
      playRecordedRef.current = false;
      accumulatedListeningSecsRef.current = 0;
      lastPlaybackTickRef.current = null;

      setCurrentTrack(track);
      currentTrackRef.current = track;
      setProgress(startPositionSecs);
      setDuration(0);

      const audioUrl = track.audioUrl;
      if (!audioUrl) {
        log("No audioUrl for track:", track.id);
        setIsPlaying(false);
        setIsLoading(false);
        return;
      }

      log("Loading audio for track:", track.id, audioUrl, startPositionSecs > 0 ? `resuming at ${startPositionSecs}s` : "");
      setIsLoading(true);
      setIsPlaying(false);

      const shouldPlayImmediately = startPositionSecs <= 0;
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: shouldPlayImmediately, progressUpdateIntervalMillis: 500 }
      );
      soundRef.current = sound;

      // Wire up real-time PCM audio sample callback for equalizer visualization.
      // setOnAudioSampleReceived fires per audio buffer (~10-20 ms). We run each
      // buffer through the FrequencyAnalyzer (5 biquad BPFs) to extract per-band
      // energy, then throttle React state updates to ~25 fps to limit re-renders.
      try {
        smoothedRmsRef.current = 0;
        lastAudioLevelUpdateRef.current = 0;

        // Create (or reuse) the analyzer. Using a lazy ref so we only allocate once.
        if (!analyzerRef.current) {
          analyzerRef.current = new FrequencyAnalyzer();
        }
        analyzerRef.current.reset();

        sound.setOnAudioSampleReceived((sample) => {
          if (!analyzerRef.current) return;

          // Use the first channel for frequency analysis; mix for overall RMS.
          const ch0 = sample.channels[0]?.frames ?? [];

          // Compute overall RMS across all channels (for fallback audioLevel)
          let sum = 0;
          let count = 0;
          for (const channel of sample.channels) {
            for (const frame of channel.frames) {
              sum += frame * frame;
              count++;
            }
          }
          const instantRms = count > 0 ? Math.sqrt(sum / count) : 0;
          const alphaRms = instantRms > smoothedRmsRef.current ? 0.9 : 0.3;
          smoothedRmsRef.current = alphaRms * instantRms + (1 - alphaRms) * smoothedRmsRef.current;

          // Run the frequency analyzer on channel 0 frames
          const bands = analyzerRef.current.process(ch0);

          // Throttle state updates to ~25 fps
          const now = Date.now();
          if (now - lastAudioLevelUpdateRef.current < 40) return;
          lastAudioLevelUpdateRef.current = now;

          // Normalize overall RMS → audioLevel (fallback for components that use it)
          const MIN_RMS = 0.01;
          const MAX_RMS = 0.35;
          const normalized = Math.max(0, Math.min(1,
            (smoothedRmsRef.current - MIN_RMS) / (MAX_RMS - MIN_RMS)
          ));
          setAudioLevel(normalized);
          setFrequencyBands(bands);
        });
      } catch {
        // setOnAudioSampleReceived not supported on this platform — fall back to null
        setAudioLevel(null);
        setFrequencyBands(null);
      }

      if (startPositionSecs > 0) {
        await sound.setPositionAsync(startPositionSecs * 1000);
        await sound.playAsync();
      }

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          if (status.error) log("Playback error:", status.error);
          return;
        }
        setIsPlaying(status.isPlaying);
        setIsLoading(false);
        const positionSecs = status.positionMillis / 1000;
        setProgress(positionSecs);
        if (status.durationMillis) {
          setDuration(status.durationMillis / 1000);
        }
        if (currentTrackRef.current && status.positionMillis > 0) {
          const now = Date.now();
          if (now - lastPlaybackSaveRef.current >= 5000) {
            lastPlaybackSaveRef.current = now;
            const trackId = currentTrackRef.current.id;
            AsyncStorage.setItem(
              playbackKey(userIdRef.current),
              JSON.stringify({ trackId, position: positionSecs })
            ).catch(() => {});
            // Sync to server at a longer interval (30s) to avoid excessive API calls
            if (isAuthenticatedRef.current && now - lastServerPlaybackSaveRef.current >= 30000) {
              lastServerPlaybackSaveRef.current = now;
              savePlaybackState({ trackId, position: positionSecs }).catch((err) => {
                log("savePlaybackState server error:", err);
              });
            }
          }
        }
        // Accumulate active listening time — only while the track is actually playing.
        // Using wall-clock deltas between consecutive status-update ticks means seeking
        // forward or restoring a saved position does NOT inflate the counter; only real
        // continuous playback adds time. Deltas are clamped to 2 s to guard against
        // large gaps (e.g. app waking from background).
        const now = Date.now();
        if (status.isPlaying) {
          if (lastPlaybackTickRef.current !== null) {
            const deltaSecs = Math.min((now - lastPlaybackTickRef.current) / 1000, 2);
            accumulatedListeningSecsRef.current += deltaSecs;
          }
          lastPlaybackTickRef.current = now;
        } else {
          // Paused — reset tick so the gap is not counted when playback resumes.
          lastPlaybackTickRef.current = null;
        }

        // Record a play once the user has genuinely listened: 30 seconds of active
        // playback OR 50% of the track duration heard — whichever comes first.
        // Thresholds are based on accumulated listened time, NOT absolute position,
        // so seeks and restored positions cannot artificially satisfy them.
        // playRecordedRef guards against double-counting within the same track load.
        if (!playRecordedRef.current && status.isPlaying) {
          const durationSecs = status.durationMillis ? status.durationMillis / 1000 : 0;
          const accumulated = accumulatedListeningSecsRef.current;
          const halfwayReached = durationSecs > 0 && accumulated >= durationSecs * 0.5;
          const thirtySecsReached = accumulated >= 30;
          if (halfwayReached || thirtySecsReached) {
            playRecordedRef.current = true;
            const trackId = currentTrackRef.current?.id;
            if (trackId) {
              log("Play threshold reached for track:", trackId, "(accumulated:", accumulated.toFixed(1), "s, dur:", durationSecs, "s)");
              // Increment the play count only after the server confirms the play,
              // then invalidate tracks so the authoritative server value takes over.
              recordPlay(trackId).then(() => {
                setPlayCountDeltas((prev) => ({
                  ...prev,
                  [trackId]: (prev[trackId] ?? 0) + 1,
                }));
                // Invalidate both the main tracks list and the trending list so
                // every screen that shows play counts gets fresh server values.
                queryClientRef.current.invalidateQueries({ queryKey: ["tracks"] });
                queryClientRef.current.invalidateQueries({ queryKey: ["trending"] });
              }).catch((err) => {
                log("recordPlay error:", err);
              });
            }
          }
        }

        if (status.didJustFinish) {
          log("Track finished, advancing to next");
          setIsPlaying(false);
          setProgress(0);
          AsyncStorage.removeItem(playbackKey(userIdRef.current)).catch(() => {});
          advanceToNext();
        }
      });
    } catch (err) {
      log("playTrack error:", err);
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, [advanceToNext]);

  // Insert a track right after the current one in the queue (or at the front if nothing is playing).
  // If the queue is empty, initialize it from rawTracks first so next/prev keep working.
  const playNext = useCallback((track: Track) => {
    const currentId = currentTrackRef.current?.id;
    let queue = [...queueRef.current];
    if (queue.length === 0) {
      queue = rawTracksRef.current.map((t) => t.id);
    }
    const currentIdx = currentId ? queue.indexOf(currentId) : -1;
    queue.splice(currentIdx + 1, 0, track.id);
    queueRef.current = queue;
    AsyncStorage.setItem(queueKey(userIdRef.current), JSON.stringify(queue)).catch(() => {});
    log("playNext: inserted", track.id, "at index", currentIdx + 1);
  }, []);

  // Append a track to the end of the queue.
  // If the queue is empty, initialize it from rawTracks first.
  const addToQueue = useCallback((track: Track) => {
    let queue = [...queueRef.current];
    if (queue.length === 0) {
      queue = rawTracksRef.current.map((t) => t.id);
    }
    queue.push(track.id);
    queueRef.current = queue;
    AsyncStorage.setItem(queueKey(userIdRef.current), JSON.stringify(queue)).catch(() => {});
    log("addToQueue: appended", track.id, "queue length now", queue.length);
  }, []);

  // Toggle shuffle on/off. Persists state and shuffled/original queues to AsyncStorage.
  // Side effects are kept outside the setState updater so they don't double-fire in
  // React Strict Mode (where updater functions may be called twice in development).
  const toggleShuffle = useCallback(() => {
    setIsShuffled((prev) => !prev);

    if (!isShuffled) {
      // Turning ON shuffle
      let queue = [...queueRef.current];
      if (queue.length === 0) {
        queue = rawTracksRef.current.map((t) => t.id);
        queueRef.current = queue;
      }
      // Save original order so we can restore it when shuffle is turned off
      originalQueueRef.current = queue;
      // Fisher-Yates shuffle
      const shuffled = [...queue];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = shuffled[i];
        shuffled[i] = shuffled[j]!;
        shuffled[j] = tmp!;
      }
      // Bring the currently playing track to the front so it keeps playing
      const currentId = currentTrackRef.current?.id;
      if (currentId) {
        const idx = shuffled.indexOf(currentId);
        if (idx > 0) {
          shuffled.splice(idx, 1);
          shuffled.unshift(currentId);
        }
      }
      queueRef.current = shuffled;
      AsyncStorage.setItem(queueKey(userIdRef.current), JSON.stringify(shuffled)).catch(() => {});
      AsyncStorage.setItem(originalQueueKey(userIdRef.current), JSON.stringify(originalQueueRef.current)).catch(() => {});
      AsyncStorage.setItem(shuffleKey(userIdRef.current), "1").catch(() => {});
      log("Shuffle ON: queue randomised,", shuffled.length, "tracks");
    } else {
      // Turning OFF shuffle — restore original order
      if (originalQueueRef.current.length > 0) {
        queueRef.current = [...originalQueueRef.current];
        AsyncStorage.setItem(queueKey(userIdRef.current), JSON.stringify(originalQueueRef.current)).catch(() => {});
      }
      originalQueueRef.current = [];
      AsyncStorage.removeItem(originalQueueKey(userIdRef.current)).catch(() => {});
      AsyncStorage.setItem(shuffleKey(userIdRef.current), "0").catch(() => {});
      log("Shuffle OFF: queue restored");
    }
  }, [isShuffled]);

  // Public API: if a queue is provided by the caller, use it directly; otherwise snapshot rawTracks.
  const playTrack = useCallback(async (track: Track, queue?: Track[]) => {
    if (queue && queue.length > 0) {
      const ids = queue.map((t) => t.id);
      queueRef.current = ids;
      AsyncStorage.setItem(queueKey(userIdRef.current), JSON.stringify(ids)).catch(() => {});
      log("Queue set from caller:", ids.length, "tracks");
      await playTrackInternal(track, false);
    } else {
      await playTrackInternal(track, true);
    }
  }, [playTrackInternal]);

  const togglePlay = useCallback(async () => {
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
            if (currentTrackRef.current) {
              const now = Date.now();
              lastPlaybackSaveRef.current = now;
              const trackId = currentTrackRef.current.id;
              const position = status.positionMillis / 1000;
              AsyncStorage.setItem(
                playbackKey(userIdRef.current),
                JSON.stringify({ trackId, position })
              ).catch(() => {});
              if (isAuthenticatedRef.current) {
                lastServerPlaybackSaveRef.current = now;
                savePlaybackState({ trackId, position }).catch((err) => {
                  log("savePlaybackState server error:", err);
                });
              }
            }
          } else {
            await soundRef.current.playAsync();
            setIsPlaying(true);
          }
          return;
        }
      } catch (err) {
        log("togglePlay error:", err);
      }
    }
    if (currentTrackRef.current) {
      await playTrackInternal(currentTrackRef.current);
    }
  }, [playTrackInternal]);

  const nextTrack = useCallback(async () => {
    const currentId = currentTrackRef.current?.id;
    const queue = queueRef.current;
    if (queue.length > 0) {
      const idx = currentId ? queue.indexOf(currentId) : -1;
      const nextId = queue[(idx + 1) % queue.length];
      const next = rawTracksRef.current.find((t) => t.id === nextId);
      if (next) { await playTrackInternal(next); return; }
    }
    // Fallback: use raw track list order
    const idx = rawTracksRef.current.findIndex((t) => t.id === currentId);
    const next = rawTracksRef.current[(idx + 1) % rawTracksRef.current.length];
    if (next) await playTrackInternal(next);
  }, [playTrackInternal]);

  const prevTrack = useCallback(async () => {
    if (progress > 3 && soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(0);
        setProgress(0);
      } catch (err) {
        log("prevTrack seek error:", err);
      }
      return;
    }
    const currentId = currentTrackRef.current?.id;
    const queue = queueRef.current;
    if (queue.length > 0) {
      const idx = currentId ? queue.indexOf(currentId) : 0;
      const prevId = queue[(idx - 1 + queue.length) % queue.length];
      const prev = rawTracksRef.current.find((t) => t.id === prevId);
      if (prev) { await playTrackInternal(prev); return; }
    }
    // Fallback: use raw track list order
    const tracks = rawTracksRef.current;
    const idx = tracks.findIndex((t) => t.id === currentId);
    const prev = tracks[(idx - 1 + tracks.length) % tracks.length];
    if (prev) await playTrackInternal(prev);
  }, [progress, playTrackInternal]);

  const seekTo = useCallback(async (position: number) => {
    setProgress(position);
    if (currentTrackRef.current) {
      const trackId = currentTrackRef.current.id;
      AsyncStorage.setItem(
        playbackKey(userIdRef.current),
        JSON.stringify({ trackId, position })
      ).catch(() => {});
      if (isAuthenticatedRef.current) {
        const now = Date.now();
        lastServerPlaybackSaveRef.current = now;
        savePlaybackState({ trackId, position }).catch((err) => {
          log("savePlaybackState server error:", err);
        });
      }
    }
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setPositionAsync(position * 1000);
        }
      } catch (err) {
        log("seekTo error:", err);
      }
    }
  }, []);

  const confirmCrossDeviceResume = useCallback(async () => {
    const cd = crossDeviceResumeRef.current;
    if (!cd) return;
    setCrossDeviceResume(null);
    const track = rawTracksRef.current.find((t) => t.id === cd.trackId);
    if (!track) return;
    restoredPositionRef.current = { trackId: cd.trackId, position: cd.position };
    await playTrackInternal(track);
  }, [playTrackInternal]);

  const dismissCrossDeviceResume = useCallback(() => {
    setCrossDeviceResume(null);
    const local = localPlaybackBackupRef.current;
    if (local) {
      hasRestoredRef.current = false;
      setSavedPlayback(local);
    }
  }, []);

  const toggleLike = useCallback((id: string) => {
    // Read the current liked state synchronously from the stable ref — this avoids
    // relying on a mutable variable set inside a state updater, which React does not
    // guarantee will be called synchronously before the next line executes.
    const nowLiked = !likedIdsRef.current.has(id);

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (nowLiked) next.add(id); else next.delete(id);
      likedIdsRef.current = next;
      AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });

    // Optimistically adjust the like count so UI updates immediately on tap.
    setLikeDeltas((prev) => ({
      ...prev,
      [id]: (prev[id] ?? 0) + (nowLiked ? 1 : -1),
    }));

    // Persist to server if authenticated. On success, invalidate the tracks cache so
    // React Query refetches authoritative like counts. When fresh data arrives, the
    // tracksUpdatedAt effect resets all likeDeltas — this avoids clearing the delta
    // prematurely (before new data lands) which would revert the count to a stale value.
    if (isAuthenticated) {
      likeTrack(id, { liked: nowLiked })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["tracks"] });
        })
        .catch((err) => {
          log("likeTrack server error:", err);
        });
    }
  }, [isAuthenticated, queryClient]);

  const addToLibrary = useCallback((id: string) => {
    setLibraryIds((prev) => {
      const next = new Set(prev);
      next.add(id);

      if (isAuthenticated) {
        saveToLibrary(id, { saved: true }).catch((err) => {
          log("saveToLibrary server error:", err);
        });
      }
      AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [isAuthenticated]);

  const removeFromLibrary = useCallback((id: string) => {
    setLibraryIds((prev) => {
      const next = new Set(prev);
      next.delete(id);

      if (isAuthenticated) {
        saveToLibrary(id, { saved: false }).catch((err) => {
          log("saveToLibrary server error:", err);
        });
      }
      AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [isAuthenticated]);

  const tracks = rawTracks.map((t) => ({ ...t, liked: likedIds.has(t.id) }));
  const likedTracks = tracks.filter((t) => likedIds.has(t.id));
  const libraryTracks = tracks.filter((t) => libraryIds.has(t.id));

  // Derive the current track from the live `tracks` array so that likes and liked
  // state always reflect the latest optimistic deltas without a stale snapshot.
  const contextCurrentTrack = currentTrack
    ? (tracks.find((t) => t.id === currentTrack.id) ?? { ...currentTrack, liked: likedIds.has(currentTrack.id) })
    : null;

  return (
    <PlayerContext.Provider value={{
      tracks,
      isLoadingTracks,
      currentTrack: contextCurrentTrack,
      isPlaying,
      isLoading,
      progress,
      duration,
      audioLevel,
      frequencyBands,
      likedIds,
      libraryIds,
      playTrack,
      playNext,
      addToQueue,
      isShuffled,
      toggleShuffle,
      togglePlay,
      nextTrack,
      prevTrack,
      seekTo,
      toggleLike,
      addToLibrary,
      removeFromLibrary,
      likedTracks,
      libraryTracks,
      crossDeviceResume,
      confirmCrossDeviceResume,
      dismissCrossDeviceResume,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
