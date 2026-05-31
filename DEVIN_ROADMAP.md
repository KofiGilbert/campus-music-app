# Campus Music — Production-Grade MVP Roadmap

> Audit + roadmap for taking Campus Music from "Replit prototype with seeded data + mocked UI" to a launchable MVP.
> **Scope:** Spotify × TikTok/Instagram hybrid for college campuses. Two user types: **artists** (upload + share music) and **listeners** (discover + follow).
> **Surface area:** Expo/React Native mobile app (primary), Express 5 + Drizzle API server, Postgres (Supabase) DB isolated in `campus_music` schema. Legacy Vite web app (`artifacts/campus-music`) is effectively empty (one splash screen) and is the most natural place to host an **admin web app**.

> **Scope philosophy:** every feature visible in the current mobile UI ships for MVP — no cutting features just because we're labeling it MVP. The trade is **timeline**, not surface area. Items deferred post-MVP (§5) are features that are not already promised by the UI today (OAuth, 2FA, offline downloads, i18n).

> **Quality bar:** Spotify- / Apple-Music-class artist discovery platform that is **AI-native from the schema up** — because the platforms that win the next decade of music will be the ones whose data model treats embeddings, stems, structured lyrics, provenance and consent as first-class citizens, not afterthoughts. Six non-negotiable architecture decisions follow from this: **(a) multi-bitrate audio transcoding on upload**, **(b) audio served via CDN with signed URLs**, **(c) live-session-to-track auto-publish** (the killer feature Spotify can't do), **(d) a recommendations engine designed-for from day one** (don't paint ourselves into a corner with the schema), **(e) Campus Music TV** — our own in-app TV station (trending-artist segments, studio interviews, daily talk show) as the editorial flywheel for discovery, **(f) AI foundations** baked into Phase 2 (audio embeddings, stems separation, structured lyrics, AI provenance + consent + safety + credits) so every later AI feature (Studio Assistants, Cross-Campus Collab Studio, AI A&R, Karaoke, Mashups, Translate-and-Cover) is purely additive instead of a re-architecture. See §3.13–§3.19.

---

## Legend

- Status: **Built ✅** / **Stubbed/Fake ⚠️** / **Missing ❌**
- Effort: **S** (≤ 1 day), **M** (2–5 days), **L** (1–2 weeks), **XL** (>2 weeks)
- Priority: **P0** (launch blocker) / **P1** (core experience) / **P2** (polish)

---

## 1. Codebase Audit

### 1.1 Repository Topology

```
campus-music-app/
├── artifacts/
│   ├── api-server/              # Express 5 + Drizzle backend (real, mostly wired up)
│   ├── campus-music-mobile/     # Expo / React Native app (Web + iOS + Android) — primary surface
│   └── campus-music/            # Legacy Vite SPA — currently ONLY a splash screen
├── lib/
│   ├── db/                      # Drizzle schema, isolated in Postgres schema `campus_music`
│   ├── api-spec/                # OpenAPI spec (orval-generated client targets)
│   ├── api-client-react/        # React-Query client generated from OpenAPI
│   └── api-zod/                 # Zod schemas shared between client and server
├── scripts/                     # Small TS scripts + post-merge hook
├── pnpm-workspace.yaml          # Workspace + catalog + Linux-only native overrides
├── .replit                      # Replit deployment + ports
├── RUNNING.md / TROUBLESHOOTING.md / CONTRIBUTING.md
└── .github/pull_request_template.md  # Only GH artifact present — NO workflows
```

**Tech stack:** Node 24, TypeScript 5.9, Drizzle 0.45, Express 5, React 19.1, Expo 54, React-Query, Tailwind v3/v4 (mixed), JWT via `jose`, bcryptjs, GCS via `@google-cloud/storage` + Replit sidecar.

### 1.2 Database Schema (`lib/db/src/schema/`)

All tables live in a dedicated `campus_music` Postgres schema. Eight tables total, no SQL migration files on disk — only Drizzle `push` (the post-merge hook runs `pnpm --filter db push`).

| Table | Cols | Purpose | Notes |
|---|---|---|---|
| `users` | id, username, password, email, name, role(`listener`\|`artist`), university, country, avatarUrl | Auth + profile | `username` is set to `email` on register; no `emailVerified`, no `createdAt/updatedAt`, no `bio`, no `pushToken` |
| `tracks` | id, title, artist, artistId, genre, duration, durationSeconds, coverColor, audioUrl, coverUrl, playCount, university | Music catalog | Denormalized `artist` string + `artistId`; no `createdAt`, no `description`, no `releaseDate`, no `isPublished` |
| `artists` | id, name, genre, university, coverColor, avatarUrl, bio | Artist profiles | **Separate from `users`** — seeded artists `a1`…`a10` have no matching user row; for real artists `artist.id === user.id` (informal contract enforced in `/artists/:id` PATCH) |
| `user_likes` | (userId, trackId) PK | Track likes | |
| `user_library` | (userId, trackId) PK | Saved-to-library | |
| `artist_follows` | (userId, artistId, createdAt) PK | Artist follows | Seeded with fake user IDs `seed_f_001…` to inflate follower counts |
| `user_connections` | (fromUserId, toUserId) PK, status(`pending`\|`accepted`), createdAt | Friend graph | Supports virtual `user-<artistId>` IDs so artists can be "befriended" |
| `user_playback` | userId PK, trackId, position, updatedAt | Cross-device resume | **Single row per user → no playback history** |

**What's missing from the schema for an MVP that ships every feature already shown in the UI:**

- ❌ `posts` table (the home feed currently fabricates posts from artists + tracks in the mobile client).
- ❌ `comments` table (music-feed uses a hardcoded comment pool per track).
- ❌ `post_likes` / `post_shares` / `post_reposts` tables.
- ❌ `notifications` table + `push_tokens` table.
- ❌ `play_history` (per-listen timestamped records; currently only a counter on `tracks.playCount`).
- ❌ `conversations` / `messages` / `message_reads` tables (Messages screen is fully hardcoded).
- ❌ `live_sessions` + `live_session_participants` + `live_chat_messages` (Live Now is fully simulated).
- ❌ `podcasts` + `podcast_episodes` (Campus Podcasts on Discover is hardcoded).
- ❌ `playlists` + `playlist_tracks` (we'll need these — see §2.11).
- ❌ `flags` / `reports` / `bans` for moderation + admin panel.
- ❌ `email_verifications` / `password_resets` (OTP is in-memory).
- ❌ `refresh_tokens` (JWT is 30-day, no refresh flow).
- ❌ Foreign keys + indexes: schema has **zero `references()` and zero explicit indexes**. Joins work because columns happen to match. This is fine for prototype but unsafe for production (orphaned rows + slow queries).
- ❌ `createdAt`/`updatedAt` on most tables.
- ❌ Real SQL migration files (only `drizzle-kit push`, which is dev-grade).

### 1.3 API Server (`artifacts/api-server/src/routes/`)

The server is the most "real" part of the codebase. CORS is wide-open, JWT is HS256/30d (no refresh), Pino logging is wired up.

| Endpoint | Status | Notes |
|---|---|---|
| `GET /healthz` | ✅ | |
| `POST /auth/signup` / `/auth/register` | ✅ | bcrypt + JWT, no email verification gate |
| `POST /auth/login` | ✅ | |
| `POST /auth/logout` | ⚠️ | Returns `{message: "Logged out"}` — no server-side invalidation (stateless JWT) |
| `GET /auth/me` / `PATCH /auth/me` | ✅ | |
| `POST /auth/otp/send` / `/auth/otp/verify` | ⚠️ | **In-memory `Map`** — wiped on restart. In dev, the code is **returned in the response** (`devCode`). No email sender wired. |
| `POST /tracks` (create) | ✅ | Artist-only; promotes cover URL to public ACL if it was issued via upload registry |
| `GET /tracks` | ✅ | Filters: genre / university / artistId / limit (in-memory filter, full table scan) |
| `GET /tracks/trending` | ✅ | `ORDER BY playCount DESC` |
| `GET /tracks/most-liked` | ✅ | `LEFT JOIN userLikes` aggregate in app code |
| `GET /tracks/liked` / `/library` | ✅ | Returns array of track IDs |
| `GET/PATCH/DELETE /tracks/:id` | ✅ | Ownership-checked |
| `POST /tracks/:id/play` | ✅ | Increments `playCount` (no per-user history row) |
| `POST /tracks/:id/like` | ✅ | Real toggle into `user_likes` |
| `POST /tracks/:id/library` | ✅ | Real toggle into `user_library` |
| `GET /feed` | ⚠️ | **Just returns tracks ordered by `playCount`** — not a "social posts" feed |
| `POST /feed/:id/like` | ❌ | **Computes a number and returns it but never writes anything** (see [`feed.ts:28-42`](artifacts/api-server/src/routes/feed.ts)) |
| `GET /search?q=` | ⚠️ | Full table scan + JS `.includes()` — works but doesn't scale |
| `GET /universities` / `/universities/search` | ⚠️ | Union of `WELL_KNOWN` constant + `SELECT … FROM tracks/artists` (full scan) |
| `GET /artists` / `/artists/followed` / `/artists/:id` / `PATCH /artists/:id` / `POST /artists/:id/follow` | ✅ | Follower count is `COUNT(*) FROM artist_follows`. **Seeded** with `seed_f_xxx` user IDs that don't exist in `users` |
| `GET /users/:id` | ✅ | Handles both real user IDs and synthetic `user-<artistId>` IDs |
| `GET /connections/search` / `GET /connections?type=…` / `POST /connections/:userId/connect` / `POST /connections/:userId/respond` | ✅ | Real friend graph; handles `user-<artistId>` virtual IDs everywhere |
| `POST /storage/uploads/request-url` | ✅ | Artist-only. Returns GCS presigned PUT URL via the Replit sidecar (`http://127.0.0.1:1106/object-storage/...`). **Hard dependency on Replit** for token issuance. |
| `GET /storage/objects/:path` | ✅ | ACL-gated; supports public + private (owner-only) |
| `GET/POST /playback` | ⚠️ | One row per user (`userId` is PK) → **no history**, only current position |

**Server-level gaps:**

- ❌ No middleware for `requireAuth` — every route inlines the same `if (!authHeader.startsWith("Bearer ")) …` block.
- ❌ No rate limiting (login, OTP, signup, search are all unthrottled).
- ❌ No input validation framework — most routes do ad-hoc `typeof x === "string"` checks instead of using `@workspace/api-zod`.
- ❌ No central error handler / 4xx-5xx normalization.
- ❌ No request ID surfacing to clients.
- ❌ No tests (`find … -name "*.test.*"` → 0 hits).
- ❌ No CI (`.github/workflows/` does not exist; only a PR template).
- ⚠️ `cors()` accepts all origins.
- ⚠️ `JWT_SECRET` falls back to a hardcoded dev string when unset in non-production.

### 1.4 Mobile App (`artifacts/campus-music-mobile/`)

The entry point (`app/index.tsx`) is a one-liner: `<Redirect href="/(tabs)" />`. **There is no auth gate** — the entire app is browsable signed-out; specific screens just hide artist-only affordances when `!token`.

**Tab navigation** (`app/(tabs)/_layout.tsx`):
- Visible: Home, Discover, Library, Connect, Vibe (= Discover variant), Profile
- Hidden routes used as deep links / modals: Social, Upload, Trending

| Screen | Status | What it does / where it cheats |
|---|---|---|
| `(tabs)/index.tsx` (Home) | ⚠️ | Pulls real `tracks` + `artists` via React-Query → **fabricates "posts" client-side**: post body, time, category, likes, comments, reposts, shares, saves are all calculated from `followerCount` mod constants. `LIVE_ARTISTS` is hardcoded seed. |
| `(tabs)/discover.tsx` | ⚠️ | Real `/search` integration. `NOW_LISTENING_USERS`, `CAMPUS_PODCASTS`, `TRENDING_COUNTRIES` are hardcoded constants. |
| `(tabs)/library.tsx` | ✅ | Real `getLikedTrackIds` + `getLibraryTrackIds`. |
| `(tabs)/connect.tsx` | ✅ | Real `getConnections`, `searchConnections`, send/respond mutations. |
| `(tabs)/social.tsx` | ⚠️ | Real feed + artists; **marks top 1/3 of artists "live" by follower count** (no actual live state). |
| `(tabs)/upload.tsx` | ✅ | Full GCS flow: `request-url` → `PUT` to presigned URL → `POST /tracks`. Uses `expo-document-picker` for audio + `expo-image-picker` for cover. |
| `(tabs)/profile.tsx` | ✅ | Real `getMe`, artist tracks, `updateMe`, `updateTrack`, `deleteTrack`. |
| `(tabs)/trending.tsx` | ✅ | Real `/tracks/trending`. |
| `(tabs)/real-connections.tsx` | ✅ | Variant on connect.tsx — real API. |
| `live.tsx` | ❌ | **Completely mocked.** Seed chat + `AUTO_MSGS` rotated every 3.2 s. Viewer count `+= Math.random()*4`. No backend at all. |
| `messages.tsx` | ❌ | **Completely hardcoded conversations.** No backend, no DB table, no API. |
| `music-feed.tsx` | ⚠️ | Real tracks. **Per-track comment pools are hardcoded**; `submitComment` mutates local state only. |
| `player.tsx` | ✅ | Real `PlayerContext`; cross-device resume via `/playback`. |
| `profile/[id].tsx` | ✅ | Real `/users/:id`. |
| `artist/[id].tsx` | ✅ | Real `/artists/:id` + tracks. |
| `genres.tsx` / `campuses.tsx` | ✅ | Real `/tracks?genre=` / `?university=`. |
| `most-liked.tsx` | ✅ | Real `/tracks/most-liked`. |
| `onboarding/welcome → role → email → name → university → country → password → otp → notifications → follow` | ⚠️ | Real OTP API (in-memory), real `register`, real `followArtist`. **`notifications` screen is pure UI** — no `expo-notifications` dependency exists; "Allow Notifications" just navigates forward. |
| `onboarding/login.tsx` | ✅ | Real `/auth/login`. |

**Mobile-level gaps:**

- ❌ No auth gate — `app/index.tsx` redirects everyone into `(tabs)` regardless of token.
- ❌ No push notification system (`expo-notifications` is not even installed).
- ❌ No deep-link / share-sheet handling for tracks/profiles.
- ❌ No analytics events (no Segment / Mixpanel / PostHog / Amplitude).
- ❌ Error monitoring — there's an `ErrorBoundary` component but no Sentry / Bugsnag wiring.
- ⚠️ Many screens still import hardcoded Unsplash / SoundHelix URLs as fallbacks.

### 1.5 Legacy Web App (`artifacts/campus-music/`)

```tsx
// src/App.tsx
<Route path="/" component={SplashScreen} />
// src/pages/SplashScreen.tsx — just renders /figmaAssets/campus-music-logo-1.png
```

**Status:** ❌ Effectively empty. Has Tailwind + Wouter + Radix UI deps wired up but **no real screens**. Best candidate to host the admin panel — see §3.2.

### 1.6 Tooling / Infra Audit

| Area | Status |
|---|---|
| Lint | ❌ No ESLint config anywhere |
| Format | ⚠️ Prettier installed at root but no `.prettierrc` and no `format` script |
| Typecheck | ✅ `pnpm run typecheck` works (workspace `tsc --build`) |
| Tests | ❌ Zero test files; no Vitest / Jest / Detox configured |
| CI | ❌ No `.github/workflows/` |
| Migrations | ⚠️ Only `drizzle-kit push` — no SQL migration history |
| Env | ⚠️ Per-artifact `.env` files (gitignored). API requires `DATABASE_URL`; mobile uses `EXPO_PUBLIC_API_URL` |
| Deployment | ⚠️ `.replit` autoscale only — no Docker, no Fly/Vercel/Render config |
| Secrets | ⚠️ JWT secret has insecure dev fallback; GCS auth flows through Replit sidecar (`127.0.0.1:1106`) which **does not exist outside Replit** |
| Object storage | ⚠️ Works on Replit; needs replacement to deploy off-Replit |

---

## 2. MVP Roadmap (per feature area)

> Every feature already visible in the mobile UI ships for MVP. No cuts. Trade is on timeline (§4) and on features that aren't promised by the UI at all (§5).

### 2.1 Auth

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| Email + password signup | ✅ | – | P0 | – |
| Login | ✅ | – | P0 | – |
| JWT issuance | ✅ | – | P0 | – |
| **`requireAuth` middleware** (replace inline checks) | ❌ | S | P0 | – |
| **Auth gate in mobile app** (redirect unauthenticated to onboarding/welcome) | ❌ | S | P0 | – |
| **Refresh-token rotation** (short-lived access JWT + DB-backed refresh token) | ❌ | M | P0 | `refresh_tokens` table |
| **Real email verification** (gate signup behind verified email; OTP currently in-memory + leaked in dev response) | ⚠️ | M | P0 | email provider (§3.1), `email_verifications` table |
| **Password reset flow** (request + verify + reset) | ❌ | M | P0 | email provider |
| **Rate limit auth endpoints** (login, signup, OTP send/verify) | ❌ | S | P0 | rate-limit lib (§3.8) |
| Role-based onboarding (artist vs listener branches) | ✅ | – | P0 | – |
| **Logout that actually invalidates the refresh token** | ⚠️ | S | P0 | refresh tokens |
| OAuth (Google / Apple sign-in) | ❌ | M | – | Post-MVP (§5) |
| 2FA / TOTP | ❌ | M | – | Post-MVP (§5) |

### 2.2 Artist Profile

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| Bio (read + edit) | ⚠️ | S | P0 | Bio only exists on `artists` table, not `users`. Resolves with §3.5 |
| Avatar / cover photo upload | ⚠️ | M | P0 | Storage (§3.3). Today `users.avatarUrl` exists but there's no upload endpoint for it; only tracks get covers. |
| Track uploads | ✅ | – | P0 | – |
| **Multi-bitrate audio transcoding on upload** (AAC 96k / 160k / 320k) — Spotify-class playback | ❌ | M | P0 | Transcoding worker (§3.14) |
| **Audio served via CDN with signed URLs** (Cloudflare in front of R2) | ❌ | S | P0 | §3.13 |
| Edit track / delete track | ✅ | – | P0 | – |
| Follower count | ✅ | – | P0 | – |
| **Followers list (who follows me)** | ❌ | S | P0 | – |
| **Artist analytics: plays / likes / saves / new followers over time** | ❌ | M | P1 | `play_history` table |
| **Track ordering / pin to top** | ❌ | S | P1 | – |
| **Public artist URL / share sheet** | ❌ | S | P1 | deep links |

### 2.3 Listener Profile

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| Liked tracks | ✅ | – | P0 | – |
| Followed artists | ✅ | – | P0 | – |
| **Listening history** (recently played) | ❌ | M | P0 | `play_history` table (replace `tracks.playCount` increment with per-listen rows) |
| Saved-to-library | ✅ | – | P0 | – |
| **Listener bio + avatar** | ⚠️ | S | P0 | Same `avatarUrl` upload work as artists |

### 2.4 Live Now — real live audio + chat

The current `live.tsx` is fully simulated. We build it for real. **No "redefine as passive listening" cop-out** — Live Now is a marquee feature and ships as live.

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **Live audio streaming** (artist broadcasts low-latency audio to N listeners) | ❌ | L | P0 | Streaming provider (§3.6) — recommend **LiveKit Cloud** |
| **`live_sessions` table** (id, hostUserId, title, startedAt, endedAt?, listenerCount, livekitRoomName) | ❌ | S | P0 | – |
| **`POST /live/sessions` / `GET /live/sessions` / `POST /live/sessions/:id/end`** | ❌ | M | P0 | – |
| **Server-issued LiveKit access tokens** (`POST /live/sessions/:id/token` — host vs listener role) | ❌ | M | P0 | LiveKit secrets |
| **Listener join + leave (presence) tracking** | ❌ | M | P0 | – |
| **Real-time chat during a live session** | ❌ | M | P0 | WebSocket layer (§3.7) |
| **`live_chat_messages` table** + history fetch | ❌ | S | P0 | – |
| **"Currently live" tile on Home + Social tabs** (real status, not seeded) | ❌ | S | P0 | `live_sessions.endedAt IS NULL` |
| **Listening Now strip** (who's currently playing what) | ❌ | M | P1 | `play_history` w/ `lastListenedAt` index |
| **Push notification when an artist you follow goes live** | ❌ | S | P1 | After §2.7 |
| **Mobile UI rewrite of `live.tsx`** to consume real streams + real chat | ⚠️ | M | P0 | – |
| **Save a live session as a track** (post-broadcast publish — 30s after the show ends, the recording is on the artist's profile) — **promoted to P0**: this is the killer feature Spotify can't do | ❌ | M | P0 | LiveKit composite egress → ffmpeg → R2 → `tracks` row |

### 2.4b Campus Music TV — in-app TV station

Our editorial flywheel for artist discovery. Curated, scheduled video shows (Trending Artists, Studio Interviews, Daily Show, Campus Takeovers, Listening Parties) broadcast over Cloudflare Stream and automatically saved as VOD replays.

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **Cloudflare Stream account + API integration** | ❌ | S | P0 | §3.6 (b) |
| **`shows` table** (id, title, description, type, status, scheduledAt, startedAt, endedAt, hostUserId, featuredUserIds, streamId, encrypted streamKey + rtmpsUrl, playbackUrl, vodUrl, thumbnailUrl, peakViewerCount, totalViews, chatEnabled, category, tags, isRecurring, recurringSchedule, createdAt, updatedAt) | ❌ | S | P0 | – |
| **`show_chat_messages` table** (id, showId, userId, displayName, message ≤200, type, isModerated, moderatedBy, moderatedAt, createdAt) | ❌ | S | P0 | – |
| **`show_reminders` table** (id, showId, userId, notified, notifiedAt, createdAt) | ❌ | S | P0 | Push notifications (§2.7) |
| **`CloudflareStreamService`** — single touchpoint for all Cloudflare Stream API calls | ❌ | M | P0 | – |
| **REST endpoints** (`POST /shows`, `GET /shows?status=…`, `POST /shows/:id/start`, `POST /shows/:id/end`, `POST /shows/:id/remind-me`, `POST /shows/:id/chat`, moderation endpoints) | ❌ | M | P0 | – |
| **Socket.io `/tv/:showId` namespace** (chat + viewer count + presenter cues) | ❌ | M | P0 | §3.7 |
| **Producer panel in `artifacts/campus-music`** (schedule, recurring, ingest RTMPS URL+key, start/end, chat moderation, VOD library, analytics) | ❌ | L | P0 | Phase 10 admin shell |
| **Mobile TV rail on Discover** (Now Live / Upcoming / Replays) | ❌ | M | P0 | – |
| **Fullscreen HLS player with overlay chat + featured-artists strip + data-usage indicator + audio-only toggle + quality selector** | ❌ | M | P0 | `expo-av` Video |
| **"Remind me" button + push 10 min before show goes live** | ❌ | S | P0 | §2.7 |
| **Auto-VOD on session end** (Cloudflare Stream native — no extra storage code) | ❌ | S | P0 | – |
| **Studio interview invite flow** (admin invites artist → DM + calendar link) | ❌ | M | P1 | DMs (§2.x) |
| **Recurring show scheduling** (`dayOfWeek` + `timeUTC` + `timezone` auto-creates next week's stub) | ❌ | S | P1 | – |

### 2.5 Music Feed (DB-backed posts)

Today the home feed in `(tabs)/index.tsx` fabricates posts from artists + tracks. We need a real posts table.

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **`posts` table** (id, authorUserId, body, attachedTrackId?, attachedImageUrl?, createdAt, deletedAt) | ❌ | S | P0 | – |
| **`POST /posts` / `GET /posts/:id` / `DELETE /posts/:id`** | ❌ | S | P0 | – |
| **`GET /feed`** — chronological feed of posts from followed artists + connections, fall back to global popular | ⚠️ | M | P0 | Replace current feed.ts that just returns tracks |
| **Mobile: rebuild Home tab** to render real posts | ⚠️ | M | P0 | – |
| **Compose post screen** (text + attach track + attach image) | ❌ | M | P0 | – |
| **Pagination** (cursor-based) | ❌ | S | P0 | – |
| **Image attachments on posts** | ❌ | M | P1 | Storage replacement (§3.3) |
| **Mentions + hashtags** in post body (parse + clickable) | ❌ | M | P1 | – |

### 2.6 Comments, Likes, Shares, Reposts

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **`comments` table** (id, targetType, targetId, authorUserId, body, parentCommentId?, createdAt) — polymorphic across `post` and `track` | ❌ | S | P0 | – |
| `POST /:targetType/:id/comments` / `GET /:targetType/:id/comments` / `DELETE /comments/:id` | ❌ | S | P0 | – |
| **Comments on tracks** (currently fully mocked in `music-feed.tsx`) | ❌ | S | P0 | – |
| **Comments on posts** | ❌ | S | P0 | – |
| **Nested replies (one level deep)** | ❌ | S | P1 | – |
| **`post_likes` table** + endpoints | ❌ | S | P0 | – |
| **Wire real post-like + comment-like into mobile** (today they're local-state) | ⚠️ | S | P0 | – |
| **Delete broken `POST /feed/:id/like`** (currently no-op; superseded by post-likes) | ❌ | S | P0 | – |
| **`post_shares` table** + outbound share-sheet w/ deep link (mobile uses `expo-sharing`) | ❌ | M | P0 | deep links |
| **`post_reposts` table** — boost a post into followers' feeds (TikTok-style "repost") | ❌ | M | P0 | The current home feed UI already shows a "Reposts" counter — make it real |
| **Quote-post** (compose new post that embeds another post) | ❌ | M | P1 | – |

### 2.7 Notifications

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **`notifications` table** (id, userId, type, actorUserId?, targetType, targetId, createdAt, readAt?) | ❌ | S | P0 | – |
| **In-app notifications inbox** (bell icon) | ❌ | M | P0 | – |
| **Triggers**: new follower, new like on your post/track, new comment, new track from an artist you follow, new live session from an artist you follow, new DM, accepted connection request | ❌ | M | P0 | All upstream tables (§2.5–§2.6, §2.4, §2.9) |
| `GET /notifications` / `POST /notifications/:id/read` / `POST /notifications/read-all` | ❌ | S | P0 | – |
| **Push notifications** (Expo Push) | ❌ | M | P0 | `push_tokens` table; install `expo-notifications` |
| **Connect onboarding/notifications screen** to actually request permission + register a token | ❌ | S | P0 | – |
| **Notification preferences UI** (per-type toggles) | ❌ | M | P1 | – |
| **Email digest** (weekly summary of activity while away) | ❌ | M | P1 | Email provider (§3.1) |

### 2.8 Discovery

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| Tracks by genre | ✅ | – | P0 | – |
| Tracks by university | ✅ | – | P0 | – |
| Followed artists | ✅ | – | P0 | – |
| **Full-text search across tracks + artists + universities + users + podcasts** | ⚠️ | M | P0 | Today: full table scan + JS `.includes()`. Switch to Postgres `to_tsvector` + GIN index. |
| Search users (listeners + artists) as a top-level result | ⚠️ | S | P0 | Promoted from `/connections/search` |
| **Trending tracks (last 7d)** | ⚠️ | S | P0 | `play_history` window — today's is all-time |
| **Now Listening row** (real users currently playing music) | ⚠️ | M | P0 | `play_history` w/ `lastListenedAt` index; replace hardcoded `NOW_LISTENING_USERS` |
| **Trending by Country** (real, replaces hardcoded `TRENDING_COUNTRIES`) | ⚠️ | M | P0 | `play_history` grouped by `users.country` |
| **Trending by University** | ❌ | S | P0 | Same join, group by `users.university` |
| **Personalized "For You" rail** (simple: tracks liked by users you follow + same-university trending) | ❌ | M | P1 | `play_history` + `user_likes` joins |
| Genres index page | ✅ | – | P0 | – |
| Universities index page | ✅ | – | P0 | – |

### 2.9 Direct Messages

The current `messages.tsx` is fully hardcoded conversations. Build it for real.

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **`conversations` table** (id, type=`dm`\|`group`, createdAt, lastMessageAt) | ❌ | S | P0 | – |
| **`conversation_participants`** (conversationId, userId, joinedAt, lastReadAt) | ❌ | S | P0 | – |
| **`messages` table** (id, conversationId, senderUserId, body, attachedTrackId?, attachedImageUrl?, createdAt, deletedAt?) | ❌ | S | P0 | – |
| **REST endpoints**: list conversations, fetch messages (paginated), send message, mark-as-read | ❌ | M | P0 | – |
| **WebSocket channel** for real-time message delivery + typing indicators + read receipts | ❌ | M | P0 | §3.7 |
| **Mobile UI rewrite of `messages.tsx`** to consume real conversations + WebSocket | ⚠️ | L | P0 | – |
| **Conversation creation from a profile** ("Message" button on `profile/[id].tsx`) | ❌ | S | P0 | – |
| **Attach a track / image to a DM** | ❌ | M | P1 | Storage + WS |
| **Push notification on new message when app is backgrounded** | ❌ | S | P0 | After §2.7 |
| **Group DMs** | ❌ | M | P1 | Same schema supports it |

### 2.10 Podcasts (Campus Podcasts)

The Discover tab shows a "Campus Podcasts" row with 6 hardcoded series. Make it a real product surface.

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **`podcasts` table** (id, hostUserId, title, description, coverUrl, university) | ❌ | S | P0 | – |
| **`podcast_episodes` table** (id, podcastId, title, audioUrl, durationSeconds, publishedAt, description) | ❌ | S | P0 | – |
| **Podcast creation flow** (artist/podcaster role can create a series) | ❌ | M | P0 | – |
| **Episode upload** (reuses storage flow) | ❌ | M | P0 | Storage (§3.3) |
| **Endpoints**: list podcasts (filter by university), get podcast, list episodes | ❌ | S | P0 | – |
| **Subscribe to a podcast** (`podcast_subscriptions` table) | ❌ | S | P0 | – |
| **Player support** (PlayerContext already plays arbitrary audio URLs — add `episodeId` queue source) | ❌ | M | P0 | – |
| **Mobile UI: real Podcasts grid on Discover + podcast detail screen + episode list** | ⚠️ | M | P0 | – |
| **Push notification on new episode** | ❌ | S | P1 | – |

### 2.11 Playlists

Not in the mobile UI today, but a Spotify-class product without playlists feels broken. Adding for MVP.

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **`playlists` + `playlist_tracks` tables** | ❌ | S | P0 | – |
| **CRUD endpoints + reorder + add/remove track** | ❌ | M | P0 | – |
| **Mobile UI**: playlist list on Library tab, playlist detail screen, "Add to playlist" sheet on Track menu | ❌ | M | P0 | – |
| **Public vs private playlists** | ❌ | S | P1 | – |
| **Collaborative playlists** | ❌ | M | P2 | Post-MVP |
| **Auto-generated "Liked Songs" playlist** | ❌ | S | P0 | Wraps existing `/tracks/liked` |

### 2.12 Admin Panel

Repurpose `artifacts/campus-music` (the legacy Vite SPA, currently only a splash) into the admin web app. It already has Wouter + Tailwind + Radix UI wired. See §3.2.

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **Admin role on `users`** (`is_admin` boolean — keeps `role` clean for artist/listener) | ❌ | S | P0 | – |
| **`requireAdmin` middleware** on protected admin routes | ❌ | S | P0 | – |
| **Admin login** (reuse `/auth/login`, check `is_admin` claim) | ❌ | S | P0 | – |
| **User list + ban/unban + search** | ❌ | M | P0 | – |
| **Track list + takedown + search** | ❌ | M | P0 | – |
| **Post list + delete** | ❌ | M | P0 | After §2.5 |
| **Comment moderation queue** | ❌ | S | P0 | – |
| **Flagged content queue** | ❌ | M | P0 | `flags` table + mobile "Report" affordance |
| **Live sessions monitor** (force-end a session) | ❌ | M | P0 | After §2.4 |
| **Analytics dashboard** (DAU, signups, uploads, plays per day, live sessions per day, DMs sent per day) | ❌ | M | P0 | `play_history` + simple aggregations |
| **Manual artist verification** (blue check) | ❌ | S | P1 | `users.verified` flag |
| **Push-notification broadcast** (send announcement to all users / segment) | ❌ | M | P1 | After §2.7 |

### 2.13 Backend Completeness

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **Replace Replit GCS sidecar** with a portable storage backend (Supabase Storage recommended) | ⚠️ | M | P0 | §3.3 |
| **Avatar upload endpoint** (`POST /users/me/avatar`) | ❌ | S | P0 | storage backend |
| **Rate limiting** (`express-rate-limit` in-memory for MVP; Redis later) | ❌ | S | P0 | §3.8 |
| **Central validation** with `@workspace/api-zod` everywhere | ⚠️ | M | P0 | – |
| **Foreign keys + indexes** on every join column (`tracks.artistId`, `user_likes.trackId`, `artist_follows.artistId`, `user_connections.*UserId`, …) | ❌ | S | P0 | New migration |
| **`createdAt` / `updatedAt`** on every table | ❌ | S | P0 | – |
| **Real SQL migrations** (drizzle-kit `generate` checked in) — replace the `push`-everywhere flow | ⚠️ | S | P0 | – |
| **Error normalization** — central error handler, consistent `{code, message}` shape | ❌ | S | P0 | – |
| **CORS allow-list** (no more `cors()` open by default) | ⚠️ | S | P0 | – |
| **Health checks** (`/healthz` exists but no DB ping) | ⚠️ | S | P0 | – |
| **WebSocket gateway** (`socket.io` on the Express server; auth via JWT in the handshake) — used by DMs + Live chat | ❌ | M | P0 | §3.7 |
| **Tests** — integration tests for auth, tracks, posts, DMs, live session lifecycle | ❌ | L | P1 | – |

### 2.14 Infrastructure

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **CI workflow** (GitHub Actions: lint → typecheck → test on PR) | ❌ | S | P0 | – |
| **ESLint config** (typescript-eslint + react-native plugin + drizzle plugin) | ❌ | S | P0 | – |
| **Prettier config** (already installed, no rcfile) | ⚠️ | S | P0 | – |
| **Hosting decision** (Fly.io for API + Vercel for admin SPA — see §3.4) | ❌ | M | P0 | – |
| **Production Postgres** (Supabase is already provisioned; verify connection limits + pgBouncer) | ⚠️ | S | P0 | – |
| **Production object storage** (Supabase Storage — see §3.3) | ❌ | M | P0 | – |
| **LiveKit Cloud account + secrets** | ❌ | S | P0 | §3.6 |
| **Expo Push credentials** (Apple + FCM) | ❌ | S | P0 | – |
| **Mobile app builds** (`eas build` profiles for preview + production) | ❌ | M | P0 | – |
| **TestFlight + Internal Play track setup** | ❌ | M | P0 | – |
| **Crash + error reporting** (Sentry on both Expo + Express) | ❌ | S | P0 | – |
| **Analytics** (PostHog) | ❌ | M | P1 | – |
| **Backups** (Supabase point-in-time recovery on paid tier) | ⚠️ | S | P0 | Verify plan |

### 2.15 AI-native foundations (in MVP) + AI features (post-MVP)

> The platforms that win the next decade of music will be the ones that started AI-native. Foundations ride along in MVP Phase 2 so we never have to do a painful schema migration; the user-facing AI features ship as their own phases 12–17.

**Layer A — AI foundations in MVP (§3.19)**

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| **`pgvector` extension + `track_embeddings`** (CLAP, 512-dim) | ❌ | S | P0 | Phase 2 transcoder worker |
| **Stems separation on upload** (Demucs, stored alongside master in R2) | ❌ | M | P0 | Phase 2 |
| **Structured lyrics** (`lyrics_lines` + `lyrics_embeddings`, LRC upload + Whisper auto-fallback) | ❌ | M | P0 | Phase 2 |
| **`ai_jobs` queue table** + future `ai-worker` Fly app slot | ❌ | S | P0 | – |
| **`ai_generations` lineage table** (provenance) | ❌ | S | P0 | – |
| **`users.ai_consent` JSON** (granular opt-in per AI feature) | ❌ | S | P0 | – |
| **`users.ai_credits` + `ai_credit_ledger`** | ❌ | S | P0 | – |
| **Safety + content classifier wrapper** | ❌ | S | P1 | First AI text feature |
| **`AIProvider` adapter interface** (Anthropic, OpenAI, Stability, Suno, Whisper, Demucs) | ❌ | M | P1 | Phase 12 |

**Layer B — AI features (Phases 12–17, post-MVP)**

| Phase | Feature | Effort | Headline |
|---|---|---|---|
| 12 | **AI Foundations harden + ai-worker + Recs v1** | M | Spin out the ai-worker, ship "More like {track}" |
| 13 | **Pen Pal** — AI Lyrics Companion | M | Chat-style co-writer in the artist's voice |
| 13 | **Cover Studio** — AI Album Art | M | 6 art options from track + lyrics + prompt |
| 13 | **Beat Lab** — AI Instrumental Generator | L | Prompt-to-beat + hum-to-beat |
| 13 | **Demo Polish** — Studio In Your Pocket | M | Phone demo → release-ready track in 2 min |
| 14 | **Cross-Campus Collab Studio — "Sessions"** | L | **The moat.** AI-matched cross-campus collaborations with auto-aligned stems + AI mastering |
| 15 | **AI A&R Weekly Brief** | M | Personalized Sunday brief for every artist |
| 15 | **Ask Campus** — Conversational Discovery | M | Natural-language music search |
| 15 | **AI Lyric Sentiment + Theme Tagging** | S | Powers mood-based playlists |
| 15 | **Recs Engine v2** (embeddings + collaborative filtering) | M | "Made for {user}" Discover Weekly equivalent |
| 16 | **AI Karaoke Mode** | M | Strip vocals + score performances + per-campus leaderboards |
| 16 | **AI Mashup Studio** | M | Musically-valid AI mashups of two Campus Music tracks |
| 16 | **Translate-and-Cover** | M | Artist's voice in 5 languages (with consent) |
| 16 | **AI Cover Detection on upload** | S | Flag similar-to-known releases for licensing |
| 17 | **AI Campus Music TV Producer** (auto-clips + thumbnails + captions) | M | 1-hour show → 15 short clips |
| 17 | **Live AI Captions** during Live Now + Campus Music TV | S | Whisper streaming |
| 17 | **Edge AI on mobile** (lyric autocomplete, pitch detection, stems viz) | M | On-device, instant, zero server cost |
| 17 | **AI Trend Prediction** (admin-facing) | M | Predict heat 2–4 weeks ahead |

---

## 3. Key Architectural Decisions (needed BEFORE building)

### 3.1 Email provider — for OTP, verification, password reset, digests

- **Options:** Resend, Postmark, SendGrid, AWS SES, Brevo.
- **Recommendation: Resend.** Simplest DX, great deliverability for transactional mail, generous free tier (3K/mo), works from any node runtime, and the API is one fetch call. Postmark is the safe fallback if we hit volume limits.
- **Action item:** add a single `EmailService` abstraction in `lib/email` so we can swap providers later without touching routes.

### 3.2 Admin app strategy

- **Options:** (a) Build admin into `artifacts/campus-music` (existing Vite shell), (b) Build inside mobile app gated by role, (c) Build a new Next.js app, (d) Use Retool/Forest.
- **Recommendation: (a) — repurpose `artifacts/campus-music`.** It already has Tailwind, Radix UI, Wouter, React-Query, and the workspace's API client. The "splash screen only" state means nothing to throw away, and it gives admins a real desktop UI without polluting the mobile app. Avoid Next.js for now — adds build complexity we don't need for a CRUD dashboard.
- **Action item:** `lib/api-client-react` already exposes everything; add `requireAdmin`-gated screens (Users, Tracks, Posts, Comments, Flags, Live Sessions, Analytics, Broadcasts).

### 3.3 Object storage — **Cloudflare R2 for audio, Supabase Storage for avatars / cover art**

- **Status today:** GCS via Replit sidecar (`http://127.0.0.1:1106`). This only works inside Replit.
- **Decision: split media by hot/cold and by cost profile.**
  - **Audio (tracks + podcast episodes + live recordings) → Cloudflare R2.** R2 has **zero egress fees**. Audio playback is the bandwidth-heavy path; Supabase or S3 will bleed money at any real scale (10K MAU × 30 minutes/day × 160kbps ≈ multi-TB/month). R2 is S3-compatible, so the storage adapter stays trivial.
  - **Images (avatars, cover art, post images) → Supabase Storage.** Small files, fewer requests, leverages the existing Supabase project we're already paying for.
- **Both sit behind Cloudflare CDN** (`audio.campus-music.app`, `media.campus-music.app`) with signed short-TTL URLs to prevent hotlinking.
- **Action item:** replace `ObjectStorageService` with a thin `StorageProvider` interface (`putPresignedUrl`, `getSignedReadUrl`, `setVisibility`, `delete`); ship two adapters: `R2Adapter` and `SupabaseStorageAdapter`. Route audio uploads through R2, images through Supabase.

### 3.4 Hosting / deployment — **Fly.io for API (multi-region), Vercel for admin SPA**

- **Decision: Fly.io for the API + Vercel for the admin SPA.** Fly's anycast + persistent connections are required for the Socket.io gateway (DMs + live chat + notifications). At MVP we run two regions (e.g. `iad` + `lax`); add `lhr` / `fra` when international traffic justifies it.
- **Mobile** builds via Expo EAS (preview + production profiles).
- **Action item:** add `Dockerfile` to `artifacts/api-server`, `fly.toml` w/ `auto_stop_machines = false` + `min_machines_running = 1` per region, and `vercel.json` to `artifacts/campus-music`.

### 3.5 Artist data model: separate `artists` table or just a flag on `users`?

- **Today:** Both exist. `users.role = "artist"` for real signups, **plus** a separate `artists` table for the 10 seeded artists `a1`…`a10` whose IDs are not user IDs. `tracks.artistId` and `artist_follows.artistId` can refer to either. The `/connections` route invents a `user-<artistId>` virtual ID to bridge them.
- **Recommendation: collapse to a single source of truth.** Move all artist fields (`bio`, `genre`, `coverColor`) onto `users` and drop the `artists` table. Seeded `a1`…`a10` rows get re-created as real user rows (with `role=artist`, no password = "system" account, optionally email = `seed+a1@campus-music.app`). The virtual `user-<artistId>` hack across `/connections` and `/users/:id` disappears.
- **Action item:** schema migration + reseed + update routes.

### 3.6 Live streaming — **two transports for two use cases**

Live audio and Campus Music TV are different products and need different transports.

**(a) Live Now — interactive audio (artists going live):** **LiveKit Cloud**. Sub-500ms latency, audio-only rooms are cheap, RN SDK exists, role-based tokens, self-hostable if cloud egress gets too expensive. Built for DJ sets, listening parties, AMA-style sessions where the host wants to read chat in real time and shout out listeners.

**(b) Campus Music TV — broadcast video shows:** **Cloudflare Stream**. ~3× cheaper than Mux at our usage profile, **zero egress fees**, automatic VOD recording on every live stream at the same Cloudflare URL (recording cost ~$5 per 1000 minutes stored), PoPs everywhere (including West Africa for international campuses later), LL-HLS support. Critically: **Cloudflare Stream is an account-level offering** — we can use it without migrating any DNS to Cloudflare. Our Fly.io API just calls Cloudflare's Stream API; players load video from `customer-<id>.cloudflarestream.com` URLs. No infrastructure entanglement.

**Why split:** sub-500ms WebRTC is overkill for a TV show where the host reads a chat with a 5–10s buffer, and pure HLS is wrong for an interactive audio room. Building both gives us the right tool for each format.

**Big-event scaling:** if a Live Now audio session blows up past LiveKit's ~10K-per-room ceiling, we design `live_sessions.transport: "livekit" | "cloudflare_stream"` from day one and switch the room to Cloudflare Stream HLS behind a feature flag. Schema and mobile UI stay the same; only the playback layer swaps.

**Action items:**
- LiveKit Cloud project, store `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` + `LIVEKIT_WS_URL`. Server mints participant tokens (host vs listener role). Listener tokens get `canPublish=false`.
- Cloudflare account, enable Stream (pay-as-you-go), store `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_STREAM_TOKEN` + `CLOUDFLARE_CUSTOMER_SUBDOMAIN`. All Cloudflare API calls go through a single `CloudflareStreamService` so we never call the API from controllers.
- Add `live_sessions.transport` column.

### 3.7 Real-time / WebSockets — **Socket.io on Fly now, designed for swap to Ably at ~50K concurrent**

- **Decision: Socket.io on Fly.io.** Single deploy, no extra vendor, JWT-in-handshake auth, namespace per feature (`/dms`, `/live/:sessionId`, `/notifications`). Sticky sessions via Fly's `fly-replay` header.
- **Wrap the RT layer in a `RealtimeGateway` interface** (`emitToUser`, `emitToRoom`, `joinRoom`, `leaveRoom`) so a future swap to Ably / Pusher / PartyKit is one adapter swap, not a rewrite.
- **Action item:** add `socket.io` to `api-server`, expose at `/socket.io`, share `JWT_SECRET` for handshake verification.

### 3.8 Rate limiting backend

- **Options:** in-memory (`express-rate-limit`), Redis-backed (`rate-limit-redis`), Cloudflare.
- **Recommendation:** in-memory for MVP (single-node), upgrade to Redis when we scale beyond one API instance. Put strict limits on auth + OTP + post creation + DM send.

### 3.9 Migrations strategy

- **Today:** `drizzle-kit push` via post-merge hook. No SQL files checked in.
- **Recommendation:** switch to `drizzle-kit generate` → check generated SQL into `lib/db/migrations/`. Apply via `drizzle-kit migrate` in CI/CD. Keep `push` for local dev only.

### 3.10 Token strategy

- **Today:** HS256 JWT, 30-day expiry, no refresh, no rotation, no server-side invalidation. Insecure dev fallback secret.
- **Recommendation:** 15-min access token + 30-day refresh token stored in a new `refresh_tokens` table (hashed). Rotate refresh on every use. `/auth/logout` deletes the row. Required to make a real "log out" button work and to support revocation when an account is banned.

### 3.11 Admin authorization

- **Recommendation:** add `users.is_admin` boolean (so an admin can also be an artist/listener). Bake `is_admin` into the JWT claims so middleware doesn't re-query.

### 3.12 Push notifications

- **Recommendation: Expo Push Service** for the mobile app — abstracts APNs + FCM, fits the Expo build pipeline, free at any volume we'll see for years. Requires real Apple Push key + Firebase service account in EAS.

### 3.13 Audio CDN + signed URLs

- **Decision: Cloudflare in front of R2** for audio playback (`audio.campus-music.app`). Audio responses are served via Cloudflare's CDN; the API issues short-TTL signed URLs to prevent hotlinking. Similar for images (`media.campus-music.app` → Supabase Storage).
- **Why:** R2 is cheap, but per-region edge caching for hot tracks (the same Drake song getting played 50K times today) is what makes the player feel instant globally.
- **Action item:** Cloudflare zone, custom hostname rules, R2 bucket binding, signing key issued by the API.

### 3.14 Audio transcoding pipeline

- **Decision: ffmpeg-as-a-service running on a small Fly.io worker app.** Postgres-backed job queue (`upload_jobs` table) — the upload endpoint inserts a job, the worker pulls, transcodes the source to AAC 96k / 160k / 320k, uploads each variant to R2, then updates `tracks.audioUrls` (JSON column keyed by bitrate). Mobile picks bitrate based on network type (`@react-native-community/netinfo`).
- **Cover art** gets resized to 3 sizes (thumb / medium / full) during the same job via `sharp`.
- **Why not Cloudflare Stream / Mux:** Cloudflare Stream is video-only; Mux audio is overkill for the simple transcode case and locks us into their pricing. Our own ffmpeg worker is ~200 lines of code, costs $5/mo on a shared-1x Fly machine, and is the path every serious audio platform ends up walking eventually.
- **Schema impact:** `tracks.audioUrl` (single string) becomes `tracks.audioUrls` (JSON: `{ "96": "...", "160": "...", "320": "..." }`) + `tracks.processingStatus` (`pending` | `ready` | `failed`).

### 3.15 Search — Postgres FTS now, designed for Algolia / OpenSearch swap

- **Decision: Postgres `to_tsvector` + GIN indexes for MVP.** Holds us until ~100K tracks comfortably. Trigram (`pg_trgm`) for typo-tolerant fuzzy match. Per-language config (default `english`).
- **`/search` endpoint sits behind a `SearchProvider` interface** so swapping to Algolia or OpenSearch is one adapter, not a rewrite. We do not pay Algolia's $1/1000-queries pricing until we have to.
- **Action item:** add a `search_index` materialized view over tracks + artists + universities + podcasts + users, refreshed every 5 min via a cron job (cheap; updates are not real-time critical).

### 3.16 Recommendations engine — designed-for from day one, shipped post-MVP

- **The Spotify-class moat.** Discover Weekly + Release Radar are the reason Spotify won the streaming wars. We need our own version, but it's a 4–6 week build and depends on having real user behavior data first.
- **MVP discipline: design the data shape now so we don't have to re-instrument later.**
  - `play_history` rows record every play with `userId`, `trackId`, `playedAt`, `secondsListened`, `completed: boolean`, `source` (e.g. `feed`, `search`, `playlist`, `live_recording`, `recommendation`), and `context` (the playlist / feed / artist page where the play originated).
  - `user_likes`, `user_library`, `artist_follows` already capture explicit signal.
  - `track_skips` table: when a user skips a track in <30s, log it (negative signal).
- **Phase 12 (post-MVP):** item-item collaborative filtering on `play_history` co-occurrence — "users who played X also played Y" — as a nightly batch job writing to a `track_recommendations` table. Cheap, no ML infra. Surface as "Made for {user}" and "More like {track}" rows in Discover.
- **Phase 13 (post-MVP):** embeddings-based recs via sentence-transformers on track titles + artist bios + listener history; vector search via `pgvector`. This is what gets us to "Discover Weekly" quality.
- **No upfront ML cost** — just discipline on what we log from day one.

### 3.17 Campus Music TV — in-app TV station (our editorial flywheel)

- **What:** a curated, scheduled, in-app TV station hosted inside Campus Music. Show formats include **Trending Artists** (weekly), **Artists With Potential** (discovery showcase), **Studio Interviews** (artists in our virtual studio), **Daily Show**, **Campus Takeovers** (specific university gets a feature week), **Listening Parties** (premiere with live commentary). Editorial-driven, not user-generated.
- **Why:** Spotify has Spotify Originals; Apple has Apple Music Radio (Zane Lowe); NPR has Tiny Desk. These editorial properties are what differentiate a player from a destination. For an artist-discovery platform, Campus Music TV **is the discovery flywheel** — every show drives followers and plays to the featured artists.
- **Transport:** Cloudflare Stream (§3.6 (b)). RTMPS in from the producer's broadcast software (OBS / Streamyard), HLS out to viewers. Sub-10s latency is fine for this format. Every show automatically becomes a VOD replay at the same URL.
- **Schema** (a `shows` table, plus `show_chat_messages`, `show_reminders`, pattern transferred from the SuperCash live-streaming review):
  - `shows`: `id, title, description, type (trending|interview|daily_show|takeover|listening_party|special), status (scheduled|live|ended|cancelled), scheduledAt, startedAt, endedAt, hostUserId, featuredUserIds (array), streamId, streamKey (encrypted), rtmpsUrl (encrypted, presenter-only), playbackUrl, vodUrl, thumbnailUrl, peakViewerCount, totalViews, chatEnabled, category, tags, isRecurring, recurringSchedule {dayOfWeek, timeUTC, timezone}, createdAt, updatedAt`.
  - `show_chat_messages`: `id, showId, userId, displayName, message (≤200 chars), type (message|system|highlight|featured), isModerated, moderatedBy, moderatedAt, createdAt`.
  - `show_reminders`: `id, showId, userId, notified (bool), notifiedAt, createdAt` — "Remind me" button on upcoming shows.
- **Mobile UX:** new **TV** rail on Discover with three sections: **Now Live**, **Upcoming**, **Replays**. Tapping a live show opens a fullscreen HLS player with live chat overlay. Tapping a past show opens the VOD player. Featured artists in the show overlay are one tap away.
- **Admin UX (in `artifacts/campus-music`):** producer dashboard — schedule shows, get RTMPS ingest URL + stream key, start/end the broadcast, chat-moderation queue, see live analytics (concurrent viewers, peak), browse VOD library, configure recurring schedule.
- **Data-consciousness (transferred from the SuperCash Ghana review):** audio-only mode on the TV player (for users on cell data), data-usage indicator in the player ("~X MB / hour at this quality"), default to 360p / 400 kbps on cellular, ramp to 1080p only on Wi-Fi.
- **Studio interview booking:** simple admin form to invite an artist. They get a DM with a calendar link; their RSVP lands them in the show as a guest with `featuredUserIds` populated.
- **Auto-VOD library:** Cloudflare Stream records every live stream automatically. On `endShow`, we mark the show `ended` and fetch the VOD URL. Cost ~$0.60 to keep a 2-hour show forever; ~$12/month for a full month of weekly + daily shows. Configurable retention.
- **What we are NOT borrowing from the SuperCash review:** the MongoDB / Mongoose schema choices (we're on Postgres + Drizzle), and the lottery-specific game integration logic. Just the streaming-provider + show-schema pattern.

### 3.19 AI-native architecture — foundations in MVP, features post-MVP

**The thesis:** the platforms that win the next decade of music will be the ones that started AI-native — where embeddings, stems, structured lyrics, provenance, and consent are first-class citizens of the data model, not afterthoughts. We have a one-time chance to design this right because the schema is essentially greenfield.

**Layer A — AI foundations baked into MVP (Phase 2 + Phase 6 + Phase 11).** Not user-facing features yet, but every later AI feature depends on these. Cheap-to-free to run:

- **Audio embeddings on every upload** (CLAP / OpenL3, ~512-dim vectors) stored in `pgvector`. Computed by the same Fly worker that does transcoding. Powers: similar-tracks, recs, mashup matching, cover detection, copyright signaling, "find a beat that matches my voice".
- **Lyric embeddings + structured lyrics** (LRC-format synced timestamps + language + sentiment + theme tags), not a blob. Stored in `lyrics_lines` (one row per timed line) + `lyrics_embeddings` (`pgvector`). Powers: lyric search, mood playlists, AI co-writing personalization, karaoke.
- **Stems-aware upload pipeline.** If an artist has stems, accept them. If they only have a stereo mix, the transcoder worker runs **Demucs** (open-source, free, runs on CPU but faster on GPU) to separate stems on upload. Stored in R2 alongside the master. Every downstream AI feature (remix, karaoke, mashup, collab studio) is impossible without this.
- **`ai_jobs` queue + `ai-worker` Fly app.** Same pattern as the transcoder worker, separate Fly app, Postgres-backed queue. All AI inference is async, observable, cancellable. GPU machines spin up on demand for heavy jobs (Demucs, MusicGen).
- **`AIProvider` abstraction layer** with one adapter per vendor:
  - **Text + chat:** Anthropic Claude (default) + OpenAI fallback.
  - **Music generation:** Suno / Udio / MusicGen / Stable Audio (start with whichever has the cleanest API).
  - **Image generation:** Stability AI / FAL / Replicate.
  - **Speech-to-text:** OpenAI Whisper.
  - **Stems separation:** Demucs (open-source, run on our own GPU worker).
  - **Embeddings:** OpenAI text-embedding-3 + CLAP (audio).
- **`ai_credits` ledger on `users`.** Every artist gets N free credits/month (e.g. 50 generations); they can buy more. Per-call cost logged → unit economics from day one. Free tier paywalled by feature category, not a hard wall.
- **AI provenance + watermarking on every generated asset.** Track lineage in an `ai_generations` table: `userId, feature, model, inputs, outputs, cost, createdAt`. SynthID (Google) on audio, C2PA on images where supported. Mandatory disclosure label on any track / art that's AI-generated or AI-assisted.
- **Consent gates.** Artists explicitly opt in (per-feature) for their voice / likeness / catalog to be used in AI flows (cross-campus collab, translate-and-cover, AI mashups). Opt-in is granular, revocable, audited. No deepfaking by default.
- **Safety + content classifier** on every AI text output (hate / sexual / self-harm / PII leakage) before it reaches the user. Provider-native moderation + a thin wrapper that logs every block decision.
- **Telemetry feedback loop.** Every AI call logs `prompt → output → user accepted/rejected/edited`. Training data for fine-tuning our own models in year two.

**Layer B — AI features as their own phases (12–17).** See §4 for the phase plan. Each is additive — no MVP schema rework.

### 3.20 Monetary cost ballpark (for early users, well under 10K MAU)

| Provider | Tier | Notes |
|---|---|---|
| Supabase Pro | $25/mo | DB + image storage |
| Cloudflare R2 | ~$5/mo | Audio storage (10GB free), zero egress |
| Cloudflare CDN | Free | Audio + image edge caching |
| Cloudflare Stream | ~$30–60/mo | Campus Music TV broadcast (~5 shows/week × 200–500 viewers × 2hrs) + VOD storage |
| Fly.io (API + transcoder + ai-worker, 2 regions) | ~$35/mo | Persistent connections, multi-region; GPU spun up on demand |
| Vercel | Free | Admin SPA |
| LiveKit Cloud | Free → $50/mo | Audio-only live: first 1000 participant-minutes free, then $0.005/min |
| AI inference (Anthropic + Stability + Suno + Whisper) | ~$50–200/mo | Capped by `ai_credits` ledger; demand-driven |
| Resend | Free | 3K emails/mo |
| Expo EAS | $19/mo build subscription | optional, can use free tier |
| Sentry | Free | Up to 5K errors |
| PostHog | Free | 1M events/mo |
| **Total** | **~$150–250/mo** | At MVP scale, with AI foundations + Spotify-class infra + Campus Music TV |

---

## 4. Phased Build Plan

> Phase ordering is dependency-driven. Each phase is shippable on its own (mobile via Expo OTA / EAS preview, API via Fly preview deploy).

### Phase 0 — Foundations (1 week)

- ESLint + Prettier + GitHub Actions CI (lint, typecheck).
- Add `requireAuth` middleware + replace inline auth checks across all routes.
- Add auth gate in mobile app (`app/index.tsx` checks token, redirects to `/onboarding/welcome` if missing).
- Add `createdAt`/`updatedAt` + foreign keys + indexes across existing tables. Switch to `drizzle-kit generate` + checked-in SQL migrations.
- Collapse `artists` table into `users` (§3.5).
- Central error handler + CORS allow-list + DB-ping health check.

**Effort:** ~5 dev-days. **Unblocks:** everything below.

### Phase 1 — Real Auth (1 week)

- Refresh-token rotation + `refresh_tokens` table.
- Email provider integration (Resend) + real OTP send.
- Email verification gate at signup (block protected actions until verified).
- Password reset flow.
- Rate limiting on auth endpoints.
- `is_admin` flag in users + JWT claims.

**Effort:** ~5 dev-days.

### Phase 2 — Profiles + Storage + Audio Pipeline + AI Foundations (2.5 weeks)

- **Storage layer:** `StorageProvider` interface + `R2Adapter` (audio) + `SupabaseStorageAdapter` (images).
- **CDN:** Cloudflare zone w/ `audio.campus-music.app` (R2 binding) + `media.campus-music.app` (Supabase). Signed-URL issuer in the API.
- **Audio transcoding worker:** new `apps/transcoder/` Fly app, ffmpeg + sharp, pulls from `upload_jobs` table, writes 96k/160k/320k AAC variants to R2.
- Schema: `tracks.audioUrls` (JSON) + `tracks.processingStatus`; `upload_jobs` table.
- Mobile player picks bitrate via `@react-native-community/netinfo`.
- Avatar upload endpoint + UI for listener + artist (3 image sizes).
- Bio + genre + university editable on `users`.
- Followers list endpoint + screen.
- **`play_history` table with the full Spotify-class data shape**: `userId`, `trackId`, `playedAt`, `secondsListened`, `completed`, `source`, `context`. Rewrite trending to "last 7 days" off this table.
- **`track_skips` table** (negative signal for the future recs engine).
- **AI foundations baked into the same worker** (§3.19, Layer A):
  - Enable `pgvector` extension.
  - **Audio embeddings:** transcoder worker also runs CLAP → stores 512-dim vector in `track_embeddings`.
  - **Stems separation:** transcoder worker also runs Demucs → stores vocals / drums / bass / other stems in R2 alongside the master. Add `tracks.stemUrls` (JSON).
  - **Structured lyrics support:** `lyrics_lines` table (one row per timed line) + `lyrics_embeddings` (pgvector). Upload accepts LRC files; falls back to Whisper auto-transcription if artist uploads vocals-only.
  - **AI provenance schema:** `ai_generations` table (lineage), `users.ai_consent` JSON (granular opt-in per feature), `users.ai_credits` integer + `ai_credit_ledger` table.

**Effort:** ~12 dev-days.

### Phase 3 — Music Feed + Comments + Likes + Shares + Reposts (2 weeks)

- `posts`, `comments`, `post_likes`, `post_shares`, `post_reposts` tables.
- `POST /posts`, cursor-paginated `GET /feed`, comment + like + share + repost endpoints.
- Compose-post screen on mobile (text + track attach + image attach).
- Rewrite Home tab to render real posts with real engagement counts.
- Track comments wired to real `comments` table (replace `music-feed.tsx` mock).
- Quote-post compose flow.
- Mentions + hashtags parsed and clickable.
- Fix the broken `POST /feed/:id/like` endpoint (delete; superseded).
- Deep-link share URLs (`/post/:id`, `/track/:id`, `/u/:username`).

**Effort:** ~10 dev-days.

### Phase 4 — WebSocket Gateway + Direct Messages (2 weeks)

- Add `socket.io` to `api-server`; JWT-in-handshake auth.
- `conversations`, `conversation_participants`, `messages` tables.
- REST endpoints (list conversations, fetch messages, send, mark-as-read).
- Socket.io namespace `/dms` for real-time delivery + typing + read receipts.
- Rewrite mobile `messages.tsx` against real data + WebSocket.
- "Message" button on `profile/[id].tsx`.
- Track / image attachments in DMs.

**Effort:** ~10 dev-days.

### Phase 5 — Live Now (real audio + chat + live→track publish) (2.5 weeks)

- LiveKit Cloud project + secrets.
- `live_sessions` (with `transport` column for future Mux switch), `live_chat_messages` tables.
- Server-issued LiveKit access tokens (host vs listener).
- `POST /live/sessions`, `GET /live/sessions`, `POST /live/sessions/:id/end`, `POST /live/sessions/:id/token`.
- Socket.io namespace `/live/:sessionId` for chat + presence.
- Mobile `live.tsx` rewrite: host UI (start/end broadcast), listener UI (join, see other listeners, chat).
- "Currently live" tile on Home + Social tabs from real `live_sessions`.
- **Live-session → MP3 auto-publish (Spotify can't do this):** on session end, LiveKit composite egress writes the mixed audio to R2, transcoder worker creates 96k/160k/320k variants, a new `tracks` row is inserted on the artist's profile, and a push goes out to followers.

**Effort:** ~12 dev-days.

### Phase 6 — Notifications (in-app + push) (1.5 weeks)

- `notifications`, `push_tokens` tables.
- Trigger logic across routes (new follower, like, comment, track, live-start, DM, accepted connection).
- `GET /notifications` + read endpoints.
- Bell-icon inbox screen on mobile.
- `expo-notifications` install + permission flow wired into onboarding/notifications screen.
- Expo Push Service backend integration.
- Notification preferences UI (per-type toggles).

**Effort:** ~7 dev-days.

### Phase 7 — Discovery overhaul (1.5 weeks)

- `SearchProvider` interface + `PostgresFTSAdapter` (so we can swap to Algolia / OpenSearch later without rewriting).
- Postgres full-text search (`tsvector` + GIN + `pg_trgm`) via a `search_index` materialized view refreshed every 5 min.
- `/search?type=…` faceted endpoint (tracks / artists / users / universities / podcasts).
- Now Listening row backed by `play_history.lastListenedAt` window.
- Trending by Country / by University from `play_history` aggregates.
- Simple SQL-only "For You" rail (tracks liked by users you follow + same-university trending). **Not the recs engine** — that's Phase 12.

**Effort:** ~7 dev-days.

### Phase 8 — Podcasts (1.5 weeks)

- `podcasts`, `podcast_episodes`, `podcast_subscriptions` tables.
- Podcast CRUD + episode upload (reuses storage flow).
- Podcast detail screen + episode list on mobile.
- Subscribe button + push notification on new episode.
- PlayerContext support for episode queues.
- Real Campus Podcasts grid on Discover.

**Effort:** ~7 dev-days.

### Phase 9 — Playlists (1 week)

- `playlists`, `playlist_tracks` tables.
- CRUD endpoints + reorder + add/remove track.
- Auto-generated "Liked Songs" wrapper.
- Library-tab playlist list + playlist detail screen + "Add to playlist" sheet on the Track menu.

**Effort:** ~5 dev-days.

### Phase 10 — Admin Web (1.5 weeks)

- Bring `artifacts/campus-music` to life: layout shell, login (admin role-gated).
- Users list (ban/unban, search, verify).
- Tracks list (takedown).
- Posts list (delete) + comment moderation queue.
- Flags table + "Report" affordance in mobile + flag queue in admin.
- Live sessions monitor (force-end).
- Analytics page (DAU + signups + uploads + plays + DMs + live sessions per day).
- Push-notification broadcast tool.

**Effort:** ~7 dev-days.

### Phase 10.5 — Campus Music TV (2 weeks)

- Cloudflare account + Stream pay-as-you-go + custom subdomain + API token.
- `CloudflareStreamService` in `api-server`: `createLiveInput`, `getStreamStatus`, `deleteLiveInput`, `generateSignedUrl`, `getVodAsset`. Single touchpoint to the Cloudflare API.
- Schema: `shows`, `show_chat_messages`, `show_reminders` (§3.17). Encrypted `streamKey` + `rtmpsUrl` (never sent to viewers).
- REST endpoints: `POST /shows` (admin), `GET /shows?status=live|upcoming|replays`, `POST /shows/:id/start`, `POST /shows/:id/end`, `POST /shows/:id/remind-me`, `POST /shows/:id/chat`, `DELETE /shows/:id/chat/:messageId` (moderation).
- Socket.io namespace `/tv/:showId` for chat + viewer count + presenter cues.
- Producer panel in `artifacts/campus-music`: schedule shows (with recurring `dayOfWeek + timeUTC + timezone`), get RTMPS ingest URL + key, start/end broadcast, chat-moderation queue, VOD library, analytics.
- Mobile **TV** rail on Discover: **Now Live** / **Upcoming** / **Replays** sections.
- Fullscreen HLS player (`expo-av` Video) with overlay chat + featured-artists strip + data-usage indicator + audio-only toggle + quality selector (default 360p on cellular).
- "Remind me" button + push notification 10 min before show goes live.
- Auto-VOD: on `endShow`, mark `ended`, fetch VOD URL, list under Replays.
- Studio interview invite flow (admin invites an artist → they get a DM + calendar link).

**Effort:** ~10 dev-days.

### Phase 11 — Production Hardening (1.5 weeks)

- Sentry on API + mobile.
- Fly.io deploy with `fly.toml` + `Dockerfile` for API.
- Vercel deploy for admin SPA.
- Expo EAS build profiles (preview + production).
- TestFlight + Internal Play track submission.
- Backup + restore drill on Supabase.
- Integration tests for auth + tracks + posts + DMs + live lifecycle (Vitest).
- Mobile critical-flow tests (Maestro).
- PostHog analytics events on key actions.
- Load test (k6) for the WebSocket gateway and feed query.

**Effort:** ~7 dev-days.

### Phase 12 — AI Foundations harden + ai-worker (2 weeks, post-MVP)

With MVP shipped and real telemetry flowing, harden the AI layer that's been quietly recording embeddings + stems since Phase 2.

- Spin out `apps/ai-worker/` as its own Fly app (separate from the transcoder so GPU jobs don't block audio processing).
- `AIProvider` adapter implementations for: Anthropic (chat), OpenAI Whisper (STT), Stability AI / FAL (image gen), Suno / Udio (music gen), Demucs (stems, on our own GPU).
- Safety classifier wrapper on all user-facing AI text outputs.
- `ai_credits` purchase flow + Stripe integration (just topping up credits; no full monetization yet).
- AI provenance UI: "Made with AI" badge in the player, surface SynthID + C2PA where present.
- Per-feature consent screens (artists explicitly opt in to allow their voice / catalog in AI flows).
- **Recommendations engine v1**: item-item collaborative filtering on `play_history` co-occurrence + audio-embedding cosine similarity. Nightly batch job; surfaces "More like {track}" + "Because you played {artist}" rows.

**Effort:** ~10 dev-days.

### Phase 13 — Studio Assistants (3 weeks, post-MVP)

Four core artist-side AI tools, all behind the `ai_credits` ledger.

- **Pen Pal — AI Lyrics Companion** (chat-style co-writer with personal style profile per artist trained on their previous lyrics). Suggests next lines, rhymes, themes, hooks. Stored as draft rows on a `lyric_drafts` table.
- **Cover Studio — AI Album Art**. Generate 6 art options from track audio + lyrics + a user prompt. Edit via additional prompts. C2PA watermark.
- **Beat Lab — AI Instrumental Generator**. Two modes: prompt-to-beat ("90 BPM Atlanta drill in F minor with dark piano") and hum-to-beat (artist hums a melody, MusicGen extends it).
- **Demo Polish — "Studio In Your Pocket"**. Phone-recorded voice memo → noise reduction + pitch correction + AI mastering + optional auto-match to a Beat Lab instrumental. Phone demo → release-ready track in 2 minutes.

**Effort:** ~15 dev-days.

### Phase 14 — Cross-Campus Collab Studio — "Sessions" (3 weeks, post-MVP)

**The moat.** Two artists at different universities collaborate on one track with AI doing the heavy lifting.

- AI matchmaker (audio-embedding cosine similarity + lyric-theme overlap + university diversity bias): suggests collaboration partners. "Send a beat" flow from any artist page.
- `sessions` table + `session_participants` + `session_stems` + `session_edits`.
- Collab Room UI (mobile): shared timeline + stems aligned to BPM grid + per-stem mute/solo + waveform + chat panel + voice notes.
- AI key-matching + time-aligning (Librosa + custom Python on `ai-worker`).
- AI vocal placement suggestion (verse / chorus structure, given the beat).
- AI mastering on session export.
- One-tap publish-as-collab — both artists credited, both get plays + followers; the track shows up on both profiles.

**Effort:** ~15 dev-days.

### Phase 15 — AI A&R + Conversational Music Discovery + Lyric Tagging (2 weeks, post-MVP)

- **AI A&R Weekly Brief**: every Sunday, every artist gets a personalized brief covering 3 trending tracks at their university + similar campuses, 2 suggested collab partners, 1 trend they should hop on, strategic advice based on their trajectory. Generated by an LLM with the artist's stats + a structured prompt; delivered via in-app inbox + push.
- **Conversational Music Discovery — "Ask Campus"**: search bar accepts natural language ("chill drill from HBCUs for late-night study"). LLM translates to a structured query (filters + embedding similarity) over the catalog.
- **AI Lyric Sentiment + Theme Tagging on every upload** (cheap, batch). Powers playlists like "songs about heartbreak", "songs about home", "songs about Friday nights".
- **Recommendations engine v2**: "Made for {user}" / "Discover Weekly" using embeddings + collaborative filtering + university/genre bias.

**Effort:** ~10 dev-days.

### Phase 16 — AI Listener Features: Karaoke + Mashup Studio + Translate-and-Cover (2 weeks, post-MVP)

- **AI Karaoke Mode**: stems-splitter strips vocals, listener sings along, AI scores pitch + timing, per-song + per-campus leaderboards.
- **AI Mashup Studio**: AI generates a musically-valid mashup of two Campus Music tracks. Both original artists credited; new native content format.
- **Translate-and-Cover**: with the original artist's consent, AI generates a vocal in Spanish / Portuguese / French / Akan in the artist's voice. One song → multiple markets.
- **AI Cover Detection** on upload: structurally / lyrically similar to a known release → flag for licensing flow before public.

**Effort:** ~10 dev-days.

### Phase 17 — AI Campus Music TV Producer + Live Captions + Edge AI (2 weeks, post-MVP)

- **AI Clip Generator**: auto-edits a 1-hour TV show into 15 short shareable clips (15–60s) with AI-generated titles + thumbnails.
- **Auto-captions + transcriptions** on every Campus Music TV show + Live Now session (Whisper streaming).
- **AI thumbnail generation** for every show.
- **Edge AI on mobile**: small on-device models (ONNX Runtime / Core ML / TF Lite) for lyric autocomplete while writing, real-time pitch detection while recording, real-time stem visualization. Zero server cost, instant feedback.
- **AI Trend Prediction** (admin-facing): predict which campuses + genres + artists are heating up 2–4 weeks ahead. Feeds Campus Music TV editorial decisions.

**Effort:** ~10 dev-days.

### Phase summary

| Phase | Theme | Effort |
|---|---|---|
| 0 | Foundations | 1 week |
| 1 | Real Auth | 1 week |
| 2 | Profiles + Storage + Audio Pipeline + **AI Foundations** (R2 + CDN + transcoder + embeddings + stems + lyrics) | 2.5 weeks |
| 3 | Music Feed + Social Graph (comments/likes/shares/reposts) | 2 weeks |
| 4 | WebSocket Gateway + Direct Messages | 2 weeks |
| 5 | Live Now (real audio + chat + live→track publish) | 2.5 weeks |
| 6 | Notifications (in-app + push) | 1.5 weeks |
| 7 | Discovery overhaul (FTS + Now Listening + Trending by Country) | 1.5 weeks |
| 8 | Podcasts | 1.5 weeks |
| 9 | Playlists | 1 week |
| 10 | Admin Web | 1.5 weeks |
| 10.5 | **Campus Music TV** (Cloudflare Stream + scheduled shows + chat + auto-VOD) | 2 weeks |
| 11 | Production Hardening + soft launch | 1.5 weeks |
| **MVP Total** | | **~21.5 weeks** of focused work |
| 12 *(post-MVP)* | **AI Foundations harden + ai-worker + Recs v1** | 2 weeks |
| 13 *(post-MVP)* | **Studio Assistants** (Pen Pal + Cover Studio + Beat Lab + Demo Polish) | 3 weeks |
| 14 *(post-MVP)* | **Cross-Campus Collab Studio — "Sessions"** (the moat) | 3 weeks |
| 15 *(post-MVP)* | **AI A&R Weekly Brief + Ask Campus + Lyric Tagging + Recs v2** | 2 weeks |
| 16 *(post-MVP)* | **AI Karaoke + AI Mashup Studio + Translate-and-Cover + Cover Detection** | 2 weeks |
| 17 *(post-MVP)* | **AI Campus Music TV Producer + Auto-Captions + Edge AI on mobile** | 2 weeks |
| **Full AI track** | | **~14 weeks post-MVP** (one phase at a time over 3–4 calendar months with 2 engineers) |

This is one engineer working full-time. **Parallelizable to ~13 calendar weeks with two engineers for MVP**, then the AI track runs another 3–4 calendar months on top.

---

## 5. What I would NOT build for MVP

I'm keeping every feature already shown in the mobile UI **and** adding the Spotify/Apple-class infrastructure (multi-bitrate transcoding, CDN, live→track publish, recs-ready data shape). The defer list below is only for features that are **not visible in the UI today** and aren't required to be in the same conversation as Spotify / Apple Music:

- ❌ **OAuth / Google / Apple sign-in.** Email + password is enough for MVP. Apple sign-in is mandatory in the iOS App Store policy **only if** we ship other social sign-in — so deliberately shipping only email + password skirts that requirement. Add OAuth post-MVP.
- ❌ **2FA / TOTP.** Post-MVP. Push-notification-based "approve login" is a nicer alternative we can add later.
- ❌ **Offline playback / track downloads.** Requires DRM thinking, storage budgets on-device, and a sync engine. Defer.
- ❌ **Multi-language / i18n.** US college campuses first. Strings stay in English.
- ❌ **Collaborative playlists.** Single-owner playlists ship; collaboration comes later.
- ❌ **Group DMs.** Schema supports it, but the UI ships 1:1 only for MVP.
- ❌ **In-app purchases / subscriptions / tipping artists.** No monetization for MVP. Stripe Connect / RevenueCat is a separate workstream.
- ❌ **Audio fingerprinting / copyright detection** (Pex / Audible Magic). Essential at scale (~$1K+/mo + integration work), but we'll address before public listing, not for soft launch.
- ❌ **CarPlay / Android Auto.** Big lift, ~5% of college users today. Post-launch.
- ❌ **Spotify Connect-style multi-device handoff.** The `user_playback` table almost gets us there — polish post-launch.
- ❌ **ML recommendations engine in MVP itself.** The *data shape* is in (§3.16), but the actual recs engine ships as Phase 12 (item-item) + Phase 13 (embeddings), post-MVP.
- ❌ **Multi-tenant / multi-region.** Two US regions on Fly.io at launch (`iad` + `lax`); add `lhr`/`fra` later.
- ❌ **Quote-post threading beyond one level.** One-level nested replies on comments only.

Everything else that is on screen in the mobile app today **ships for MVP**, **plus** the four Spotify-class infrastructure investments (transcoding, CDN, live→track, recs-ready data).

---

## 6. Decisions taken (Spotify / Apple-Music quality bar + AI-native)

All open questions now have a recommended position from me. "Approve all defaults" is a fine reply.

| # | Decision | My position |
|---|---|---|
| 1 | **Storage** | **Cloudflare R2 for audio (zero egress) + Supabase Storage for images.** Both behind Cloudflare CDN. |
| 2 | **Email** | **Resend** with DKIM/SPF/DMARC on a real campus-music domain from day one. |
| 3 | **Hosting** | **Fly.io for API (multi-region: `iad` + `lax`) + Vercel for admin SPA.** |
| 4 | **Admin app** | **Repurpose `artifacts/campus-music`** (Vite + Wouter + Radix UI). No new Next.js app. |
| 5 | **Live audio (Live Now)** | **LiveKit Cloud** for interactive audio. `live_sessions.transport` column reserved for the Cloudflare Stream HLS fallback at "big concert" scale (>10K listeners). |
| 5a | **Campus Music TV (broadcast video)** | **Cloudflare Stream** — ~3× cheaper than Mux, zero egress, automatic VOD on every live stream, works without DNS migration. Editorial flywheel for artist discovery (Spotify Originals / Apple Music Radio analogue). See §3.17. |
| 6 | **Real-time gateway** | **Socket.io on Fly.io**, wrapped in a `RealtimeGateway` interface for future swap to Ably / PartyKit. |
| 7 | **Artist data model** | **Collapse `artists` into `users`.** Seeded `a1`…`a10` become real `users` rows with `role=artist` (system accounts). Drop the virtual `user-<artistId>` hack. |
| 8 | **Email verification gating** | **Block posting / uploading / commenting / DMs / starting a live session** behind verified email. Browsing, liking, following stays open. |
| 9 | **Initial admins** | **Just you (`kofigilbert007`).** CLI script to flip `is_admin` by email. |
| 10 | **Mobile distribution** | **TestFlight + Internal Play for the first 2 weeks of soft launch, public listings after telemetry settles.** |
| 11 | **Live-session → MP3 auto-publish** | **Promoted to P0 MVP** — this is the killer artist-discovery feature Spotify can't do. LiveKit composite egress → ffmpeg → R2 → new `tracks` row, all within ~30s of the show ending. |
| 12 | **Podcasts** | **Any user with `role=artist` can create a podcast.** No new role. |
| 13 | **AI — foundations vs features** | **AI foundations ship in MVP Phase 2** (audio embeddings, stems separation, structured lyrics, ai_jobs queue, provenance, consent, credits, safety classifier). **AI features ship post-MVP as Phases 12–17** so we never block launch on AI. |
| 14 | **AI model providers** | **Pluggable `AIProvider` interface, never lock in.** Defaults: Anthropic Claude (text/chat), Stability AI / FAL (image), Suno / MusicGen (music gen), OpenAI Whisper (STT), Demucs (stems, on our own GPU worker). |
| 15 | **Cross-Campus Collab Studio "Sessions"** | **The moat.** Ships as Phase 14 (post-MVP). Spotify / Apple Music can't do this. |
| 16 | **AI A&R Weekly Brief** | **Ships in Phase 15.** Every artist gets a personalized Sunday brief — the artist-side equivalent of Discover Weekly. |
| 17 | **AI credits + monetization** | **Free tier (50 generations/mo) for every artist, paid top-ups via Stripe.** Soft paywall, not a hard wall — every artist can try every feature. Unit economics tracked per-call from day one. |
| 18 | **AI provenance + watermarking** | **Mandatory.** SynthID on audio, C2PA on images. Every AI-assisted track / cover carries a visible "Made with AI" badge. |
| 19 | **AI consent** | **Granular opt-in per AI feature.** Artists must explicitly opt in for their voice / catalog to be used in collab AI, mashups, or translate-and-cover. Default = opt-out. Revocable, audited. |

**Additional Spotify-class architecture I'm folding in (not in v1 roadmap):**

- **Multi-bitrate audio transcoding on upload** (Phase 2). AAC at 96k / 160k / 320k. ffmpeg-as-a-service on a Fly.io worker. **Required** — without this, big audio files kill mobile listening on cell networks.
- **Cloudflare CDN with signed URLs** in front of R2 audio + Supabase images (Phase 2). Edge-cached hot tracks.
- **Search behind a `SearchProvider` interface** (Phase 7). Postgres FTS for MVP, designed for Algolia / OpenSearch swap.
- **`play_history` + `track_skips` with the full Spotify-class data shape** (Phase 2). The recs engine depends on this being right from day one.
- **Campus Music TV** (Phase 10.5). Cloudflare Stream broadcast + scheduled shows + chat moderation + auto-VOD. Our editorial flywheel for artist discovery. See §3.17.
- **AI foundations in MVP Phase 2** (§3.19, Layer A). Audio embeddings + stems separation + structured lyrics + ai_jobs queue + ai_generations lineage + ai_consent + ai_credits + safety classifier. Nothing user-facing yet — just the data shape, so Phases 12–17 are purely additive.

---

## 7. The Spotify / Apple-Music / AI gap (post-MVP roadmap)

Things I deliberately did **not** put in the MVP because they require real user data, real money, or both — but which we should plan for so we don't paint ourselves into corners:

| Item | When | Why it matters |
|---|---|---|
| **AI Foundations harden + ai-worker + Recs v1** | Phase 12, 2 weeks | Spin out the GPU-capable ai-worker; ship the first user-facing AI surface ("More like {track}" rows). |
| **Studio Assistants** — Pen Pal lyrics + Cover Studio art + Beat Lab beats + Demo Polish | Phase 13, 3 weeks | The four core artist-side AI tools. Drops the floor on "I need a studio to make music". |
| **Cross-Campus Collab Studio — "Sessions"** | Phase 14, 3 weeks | **The moat.** Two artists at different universities collaborate on one track with AI doing key-matching, time-alignment, and mastering. Spotify can't do this. |
| **AI A&R Weekly Brief + Ask Campus + Lyric Tagging + Recs v2** | Phase 15, 2 weeks | Personalized briefs for artists + conversational discovery + the moat-grade Discover Weekly equivalent. |
| **AI Karaoke + AI Mashup Studio + Translate-and-Cover + Cover Detection** | Phase 16, 2 weeks | Listener-side AI features. Karaoke is the participation engine; mashups are a new content format only possible in-platform; translate-and-cover unlocks international expansion. |
| **AI Campus Music TV Producer + Live Captions + Edge AI on mobile + Trend Prediction** | Phase 17, 2 weeks | Auto-clip TV shows for 10× social reach; on-device AI for instant feedback; trend prediction feeds editorial. |
| **OAuth (Apple + Google)** | Post-launch | Required for App Store approval *if* we ever add a paid tier. |
| **Push-to-approve login** (no 2FA codes) | Post-launch | Better UX than TOTP. |
| **Offline playback / track downloads** | Post-launch | Required to compete on "long flight" and "subway" use cases. Needs storage-budget management + DRM. |
| **CarPlay + Android Auto** | Post-launch | Required for mass-market adoption. |
| **Spotify Connect-style multi-device handoff** | Post-launch | `user_playback` is already 80% there. |
| **Audio fingerprinting / copyright detection** (Pex / Audible Magic) | Before public listing | Required to avoid DMCA notices at scale. |
| **Artist payouts** (Stripe Connect Express) | After we have monetization | Required to attract real label-signed artists. |
| **Internationalization (i18n)** | After product-market fit | US college campuses first. |
| **Group DMs + collaborative playlists** | Post-launch | Schema supports it; just UI work. |
| **Fine-tune our own models** | Year 2 | Telemetry from Phases 12–17 produces the training data. Could be: a personalized lyrics model per artist, a Campus-specific music recommendation model, a campus-trend prediction model. |

---

*Once you approve this, I'll start at Phase 0 and ship one phase at a time, with a PR per phase. Soft-launch target: ~12 calendar weeks from kickoff (2 engineers, parallel where possible).*
