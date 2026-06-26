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
│   ├── storage/                 # StorageProvider interface + R2/Supabase/Memory adapters (Phase 2)
│   └── email/                   # EmailService + Resend/Console adapters (Phase 1)
├── apps/
│   └── transcoder/              # Standalone Fly.io audio transcoding worker (Phase 2)
├── scripts/                     # Small TS scripts + post-merge hook
├── pnpm-workspace.yaml          # Workspace + catalog + Linux-only native overrides
├── .replit                      # Replit deployment + ports
├── RUNNING.md / TROUBLESHOOTING.md / CONTRIBUTING.md
├── .github/
│   ├── pull_request_template.md
│   └── workflows/ci.yml            # GitHub Actions: lint → typecheck → build → test (Postgres)
├── .husky/pre-commit               # lint-staged on commit
├── eslint.config.mjs               # Flat config: typescript-eslint + react/hooks + react-native + drizzle
├── .prettierrc.json                 # Configured but NOT enforced (no format:check in CI yet)
└── CONTRIBUTING.md                  # Contributor guide (Prettier rollout plan documented)
```

**Tech stack:** Node 24, TypeScript 5.9, Drizzle 0.45, Express 5, React 19.1, Expo 54, React-Query, Tailwind v3/v4 (mixed), JWT via `jose`, bcryptjs, R2 via `@aws-sdk/client-s3` + Supabase Storage for images (Phase 2 replaced GCS sidecar).

### 1.2 Database Schema (`lib/db/src/schema/`)

All tables live in a dedicated `campus_music` Postgres schema. 29 tables total (after Phase 6: +`conversations`, `conversation_participants`, `messages` (Phase 4), +`live_sessions`, `live_chat_messages` (Phase 5), +`notifications`, `push_tokens` (Phase 6)). The `artists` table was collapsed into `users` in Phase 0. Versioned SQL migrations checked into `lib/db/migrations/`; the post-merge hook runs `pnpm db:migrate`. `pgvector` extension enabled (Phase 2). Socket.io gateway added (Phase 4).

| Table | Cols | Purpose | Notes |
|---|---|---|---|
| `users` | id, username, password, email, name, role(`listener`\|`artist`), university, country, avatarUrl, bio, genre, coverColor, is_admin, is_system, email_verified, ai_credits, ai_consent | Auth + profile + artist data | Artists collapsed into `users` (Phase 0 §3.5). `is_system` marks seed artists (sentinel password blocks login). `is_admin` baked into JWT claims. `email_verified` boolean added (Phase 1, default false). `ai_credits` (integer, default 0) + `ai_consent` (jsonb, default '{}') added Phase 2. No `createdAt/updatedAt` yet. |
| `tracks` | id, title, artist, artistId, genre, duration, durationSeconds, coverColor, audioUrl, coverUrl, audioUrls, coverUrls, stemUrls, processingStatus, playCount, university, createdAt, updatedAt | Music catalog | FK `artistId → users(id)` ON DELETE CASCADE. Indexes on `artist_id`, `created_at DESC`. Phase 2 added `audioUrls`/`coverUrls`/`stemUrls` (jsonb variant maps) + `processingStatus` (text, default 'ready'). |
| `user_likes` | (userId, trackId) PK, createdAt | Track likes | FKs to `users(id)` + `tracks(id)` ON DELETE CASCADE |
| `user_library` | (userId, trackId) PK | Saved-to-library | |
| `artist_follows` | (userId, artistId, createdAt) PK | Artist follows | FKs to `users(id)` ON DELETE CASCADE |
| `user_connections` | (fromUserId, toUserId) PK, status(`pending`\|`accepted`), createdAt, updatedAt | Friend graph | FKs to `users(id)` ON DELETE CASCADE |
| `user_playback` | userId PK, trackId, position, updatedAt, createdAt | Cross-device resume | FKs to `users(id)` + `tracks(id)` ON DELETE CASCADE. **Single row per user → no playback history** |
| `refresh_tokens` | id (UUID PK), userId (FK), tokenHash, familyId, expiresAt, revokedAt, createdAt | Refresh-token rotation | Added Phase 1. SHA-256 hashed. Family-based reuse detection. 30-day TTL. Indexes on `token_hash`, `user_id`. |
| `password_reset_tokens` | id (UUID PK), userId (FK), tokenHash, expiresAt, usedAt, createdAt | Password reset flow | Added Phase 1. 1-hour TTL. Single-use (atomic `usedAt` conditional update). Index on `token_hash`. |
| `upload_jobs` | id (UUID PK), trackId (FK CASCADE), sourceKey, status, errorMessage, attempts, createdAt, startedAt, completedAt | Transcoder job queue | Added Phase 2. Worker polls pending jobs. Index on `(status, createdAt)`. |
| `play_history` | id (UUID PK), userId (FK CASCADE), trackId (FK CASCADE), playedAt, secondsListened, completed, source, context | Per-listen telemetry | Added Phase 2. Indexes on `(userId, playedAt DESC)`, `(trackId, playedAt)`, `(playedAt)`. |
| `track_skips` | id (UUID PK), userId (FK CASCADE), trackId (FK CASCADE), skippedAt, secondsBeforeSkip | Skip telemetry (negative signal) | Added Phase 2. Index on `(userId, trackId)`. |
| `track_embeddings` | id (UUID PK), trackId (FK CASCADE, UNIQUE), embedding (vector 512), model, createdAt | CLAP audio embeddings | Added Phase 2 (schema only). HNSW cosine index. |
| `lyrics_lines` | id (UUID PK), trackId (FK CASCADE), lineNumber, startMs, endMs, text, language | Structured synced lyrics | Added Phase 2 (schema only). Index on `(trackId, lineNumber)`. |
| `lyrics_embeddings` | id (UUID PK), lyricsLineId (FK CASCADE), embedding (vector 1536), model, createdAt | Lyric text embeddings | Added Phase 2 (schema only). |
| `ai_jobs` | id (UUID PK), type, trackId (FK SET NULL), userId (FK SET NULL), status, input, output, errorMessage, attempts, timestamps | AI job queue | Added Phase 2 (schema only). Index on `(status, createdAt)`. |
| `ai_generations` | id (UUID PK), userId (FK SET NULL), feature, model, input, output, cost, createdAt | AI provenance/lineage | Added Phase 2 (schema only). Index on `(userId, createdAt DESC)`. |
| `ai_credit_ledger` | id (UUID PK), userId (FK CASCADE), amount, reason, generationId (FK SET NULL), createdAt | AI credit ledger | Added Phase 2 (schema only). Index on `(userId, createdAt DESC)`. |
| `posts` | id (UUID PK), authorUserId (FK CASCADE), body, attachedTrackId (FK SET NULL), attachedImageUrl, type (original\|repost\|quote), originalPostId (FK SET NULL, self-ref), createdAt, updatedAt, deletedAt | Social posts | Added Phase 3. Soft-delete via `deletedAt`. Reposts/quotes are posts with `type` + `originalPostId`. Indexes on `(authorUserId, createdAt DESC)`, `(createdAt DESC)`, `(attachedTrackId)`, `(originalPostId)`. |
| `comments` | id (UUID PK), targetType (post\|track), targetId, authorUserId (FK CASCADE), body, parentCommentId (FK CASCADE, self-ref), createdAt, deletedAt | Polymorphic comments | Added Phase 3. No DB FK on targetId (validated in app code). One level of nesting via `parentCommentId`. Soft-delete via `deletedAt`. Indexes on `(targetType, targetId, createdAt)`, `(authorUserId)`, `(parentCommentId)`. |
| `post_likes` | id (UUID PK), postId (FK CASCADE), userId (FK CASCADE), createdAt | Post likes | Added Phase 3. UNIQUE(postId, userId). |
| `comment_likes` | id (UUID PK), commentId (FK CASCADE), userId (FK CASCADE), createdAt | Comment likes | Added Phase 3. UNIQUE(commentId, userId). |
| `post_shares` | id (UUID PK), postId (FK CASCADE), userId (FK CASCADE), platform, createdAt | Post shares | Added Phase 3. NO UNIQUE constraint (repeatable shares). Index on `(postId, createdAt DESC)`. |
| `conversations` | id (UUID PK), hostId (FK), topic, createdAt, updatedAt | DM conversations | Added Phase 4. |
| `conversation_participants` | id (UUID PK), conversationId (FK CASCADE), userId (FK CASCADE), joinedAt, leftAt | Conversation membership | Added Phase 4. |
| `messages` | id (UUID PK), conversationId (FK CASCADE), senderUserId (FK CASCADE), body, attachments, createdAt, updatedAt, deletedAt | Direct messages | Added Phase 4. Soft-delete via `deletedAt`. |
| `live_sessions` | id (UUID PK), hostUserId (FK CASCADE), status (active\|ended), startedAt, endedAt, description, thumbnailUrl, viewerCount | Live audio sessions | Added Phase 5. |
| `live_chat_messages` | id (UUID PK), sessionId (FK CASCADE), userId (FK CASCADE), body, createdAt | Live session chat | Added Phase 5. |
| `notifications` | id (UUID PK), userId (FK CASCADE), type, actorUserId (FK SET NULL), targetType, targetId, body, readAt, createdAt | In-app notifications | Added Phase 6. |
| `push_tokens` | id (UUID PK), userId (FK CASCADE), token (UNIQUE), platform, createdAt | Push notification tokens | Added Phase 6. |

`users` table updated: `notif_prefs` (jsonb, default '{}') added in Phase 6.

**What's missing from the schema for an MVP that ships every feature already shown in the UI:**

- ✅ ~~`posts` table~~ — **Done (Phase 3).** `posts` table with `type` column (original/repost/quote), `originalPostId` FK for reposts + quotes, soft delete via `deletedAt`.
- ✅ ~~`comments` table~~ — **Done (Phase 3).** Polymorphic `targetType + targetId` (post or track). One level of nesting via `parentCommentId`. Soft delete.
- ✅ ~~`post_likes` / `comment_likes` / `post_shares`~~ — **Done (Phase 3).** `post_likes` + `comment_likes` with UNIQUE constraint (toggle). `post_shares` without UNIQUE (repeatable). Reposts are `posts` rows with `type='repost'` (not a separate table).
- ✅ ~~`notifications` table + `push_tokens` table~~ — **Done (Phase 6).** `notifications` table with `type`, `actorUserId` (FK SET NULL), `targetType`, `targetId`, `body`, `readAt`. `push_tokens` with UNIQUE token. `users.notif_prefs` (jsonb). Migration 0011.
- ✅ ~~`play_history`~~ — **Done (Phase 2).** `play_history` table with full Spotify-class data shape (userId, trackId, playedAt, secondsListened, completed, source, context). `track_skips` table for negative signal. Trending rewritten to 7-day rolling window.
- ✅ ~~`conversations` / `messages` tables~~ — **Done (Phase 4).** `conversations` + `conversation_participants` + `messages` tables. Socket.io gateway with JWT-in-handshake auth. Real-time DM delivery via `conversation:message` events. Migration 0009.
- ✅ ~~`live_sessions` + `live_chat_messages`~~ — **Done (Phase 5).** `live_sessions` (status-tracked) + `live_chat_messages`. REST + Socket.io `/live` namespace for chat + presence. Migration 0010.
- ❌ `podcasts` + `podcast_episodes` (Campus Podcasts on Discover is hardcoded).
- ❌ `playlists` + `playlist_tracks` (we'll need these — see §2.11).
- ❌ `flags` / `reports` / `bans` for moderation + admin panel.
- ✅ ~~`email_verifications` / `password_resets`~~ — **Done (Phase 1).** `password_reset_tokens` table (single-use, 1-hour TTL). `emailVerified` boolean on `users` (set by OTP verify). OTP send now goes through `@workspace/email` (Resend in prod, console in dev).
- ✅ ~~`refresh_tokens`~~ — **Done (Phase 1).** `refresh_tokens` table with SHA-256 hashed tokens, family-based reuse detection, 30-day TTL. JWT access tokens reduced to 15 minutes.
- ✅ ~~Foreign keys + indexes~~ — **Done (Phase 0).** 9 FK constraints with ON DELETE CASCADE + 3 indexes (`users(role)`, `tracks(artist_id)`, `tracks(created_at DESC)`).
- ⚠️ `createdAt`/`updatedAt` — **Partially done (Phase 0).** Added to `tracks`, `user_likes`, `user_connections`, `user_playback`. Still missing on `users` and `user_library`.
- ✅ ~~Real SQL migration files~~ — **Done (Phase 0).** `drizzle-kit generate` + checked-in SQL in `lib/db/migrations/`. `push` replaced by `migrate`.

### 1.3 API Server (`artifacts/api-server/src/routes/`)

The server is the most "real" part of the codebase. CORS is now allow-listed (Phase 0). JWT is HS256/15m access + 30d DB-backed refresh token (Phase 1). Pino logging is wired up. Storage replaced from GCS sidecar to `StorageProvider` abstraction (Phase 2). Socket.io gateway with JWT-in-handshake auth (Phase 4). Notification service with trigger hooks (Phase 6).

| Endpoint | Status | Notes |
|---|---|---|
| `GET /healthz` | ✅ | DB-ping health check added (Phase 0) |
| `POST /auth/signup` / `/auth/register` | ✅ | bcrypt + JWT, no email verification gate |
| `POST /auth/login` | ✅ | |
| `POST /auth/logout` | ✅ Done (Phase 1) | Revokes the presented refresh token's family. |
| `GET /auth/me` / `PATCH /auth/me` | ✅ | |
| `POST /auth/otp/send` / `/auth/otp/verify` | ✅ Done (Phase 1) | **In-memory `Map`** for code storage (TTL-based). OTP send via `@workspace/email` (Resend in prod, console in dev). `devCode` only returned in non-production. `otp/verify` sets `emailVerified=true`. |
| `POST /tracks` (create) | ✅ | Artist-only; requires `requireVerified`. Accepts `sourceKey`/`coverSourceKey` (R2 keys). Enqueues `upload_jobs` for transcoding. Sets `processingStatus: 'pending'`. |
| `GET /tracks` | ✅ | Filters: genre / university / artistId / limit (in-memory filter, full table scan) |
| `GET /tracks/trending` | ✅ Done (Phase 2) | Rewritten to 7-day rolling window from `play_history`, with fallback to all-time `playCount`. Accepts `?days=` param. |
| `GET /tracks/most-liked` | ✅ | `LEFT JOIN userLikes` aggregate in app code |
| `GET /tracks/liked` / `/library` | ✅ | Returns array of track IDs |
| `GET/PATCH/DELETE /tracks/:id` | ✅ | Ownership-checked |
| `POST /tracks/:id/play` | ✅ Done (Phase 2) | `optionalAuth`. Accepts `{ secondsListened, completed, source, context }`. Inserts `play_history` for authed users. Always increments `playCount`. |
| `POST /tracks/:id/skip` | ✅ New (Phase 2) | `optionalAuth`. Records `track_skips` for authed users. |
| `GET /me/history` | ✅ New (Phase 2) | `requireAuth`. Cursor-paginated listening history from `play_history`. |
| `POST /tracks/:id/like` | ✅ | Real toggle into `user_likes` |
| `POST /tracks/:id/library` | ✅ | Real toggle into `user_library` |
| `GET /feed` | ✅ Done (Phase 3) | Rewritten: cursor-paginated posts from followed artists + accepted connections + self, with global fallback on sparse first page. Unauthenticated = recent global posts. Uses `shapePosts` batched helper. |
| ~~`POST /feed/:id/like`~~ | ❌ Removed (Phase 0) | Was a no-op; superseded by `POST /posts/:id/like`. |
| `POST /posts` | ✅ New (Phase 3) | `requireAuth` + `requireVerified`. Create original/quote/repost posts. Returns shaped post with author + engagement counts. |
| `GET /posts/:id` | ✅ New (Phase 3) | `optionalAuth`. Single post with author, engagement counts, attached track (signed URLs), `hasLiked`/`hasReposted`. |
| `DELETE /posts/:id` | ✅ New (Phase 3) | `requireAuth`. Ownership-checked. Soft delete (`deletedAt = now()`). |
| `GET /users/:id/posts` | ✅ New (Phase 3) | `optionalAuth`. Cursor-paginated posts by a specific user. Same response shape as `/feed`. |
| `POST /posts/:id/like` | ✅ New (Phase 3) | `requireAuth`. Toggle (insert/delete). Returns `{ liked, likeCount }`. UNIQUE constraint prevents duplicates. |
| `POST /posts/:id/share` | ✅ New (Phase 3) | `requireAuth`. Records share with platform. Repeatable (no UNIQUE). Returns `{ shareCount, shareUrl }`. |
| `POST /posts/:id/repost` | ✅ New (Phase 3) | `requireAuth`. Creates repost (post with `type='repost'`). 409 if already reposted. |
| `DELETE /posts/:id/unrepost` | ✅ New (Phase 3) | `requireAuth`. Soft-deletes viewer's repost of the post. |
| `POST /comments` | ✅ New (Phase 3) | `requireAuth` + `requireVerified`. Polymorphic (targetType: post/track). One-level nesting enforced. |
| `GET /comments` | ✅ New (Phase 3) | `optionalAuth`. Cursor-paginated. Top-level comments with up to 3 eager replies. `?targetType=&targetId=`. |
| `DELETE /comments/:id` | ✅ New (Phase 3) | `requireAuth`. Ownership-checked. Soft delete. |
| `POST /comments/:id/like` | ✅ New (Phase 3) | `requireAuth`. Toggle. Returns `{ liked, likeCount }`. |
| `GET /search?q=` | ⚠️ | Full table scan + JS `.includes()` — works but doesn't scale |
| `GET /universities` / `/universities/search` | ⚠️ | Union of `WELL_KNOWN` constant + `SELECT … FROM tracks/artists` (full scan) |
| `GET /artists` / `/artists/followed` / `/artists/:id` / `PATCH /artists/:id` / `POST /artists/:id/follow` | ✅ | Follower count is `COUNT(*) FROM artist_follows`. **Seeded** with `seed_f_xxx` user IDs that don't exist in `users` |
| `GET /users/:id` | ✅ | Handles both real user IDs and synthetic `user-<artistId>` IDs |
| `GET /connections/search` / `GET /connections?type=…` / `POST /connections/:userId/connect` / `POST /connections/:userId/respond` | ✅ | Real friend graph; handles `user-<artistId>` virtual IDs everywhere |
| `POST /storage/uploads/request-url` | ✅ Done (Phase 2) | Artist-only. Returns R2 presigned PUT URL via `StorageProvider`. GCS sidecar dependency removed. |
| `POST /users/me/avatar` | ✅ New (Phase 2) | `requireAuth` + `requireVerified`. Multipart upload → sharp 3-size resize (64/256/512 WebP) → Supabase Storage. Returns `{ avatarUrl, avatarUrls }`. |
| `GET /artists/:id/followers` | ✅ New (Phase 2) | Cursor-paginated followers list. Returns `{ followers, nextCursor }`. |
| `GET/POST /playback` | ⚠️ | One row per user (`userId` is PK) → **no history**, only current position |
| `POST /auth/refresh` | ✅ New (Phase 1) | Rotates refresh token (revoke old + issue new in same family). Returns fresh `{token, accessToken, refreshToken, user}`. |
| `POST /auth/password/forgot` | ✅ New (Phase 1) | Rate-limited. Always returns `{sent: true}` (no email enumeration). Sends reset link via email. |
| `POST /auth/password/reset` | ✅ New (Phase 1) | Rate-limited. Consumes single-use token, bcrypt-hashes new password, revokes all refresh tokens. |
|| `POST /conversations` | ✅ New (Phase 4) | `requireAuth`. Create or retrieve a DM conversation. |
|| `GET /conversations` | ✅ New (Phase 4) | `requireAuth`. List user's conversations. |
|| `GET /conversations/:id` | ✅ New (Phase 4) | `requireAuth`. Single conversation with participants. |
|| `POST /conversations/:id/messages` | ✅ New (Phase 4) | `requireAuth`. Send a message. Emits `conversation:message` via Socket.io. |
|| `GET /conversations/:id/messages` | ✅ New (Phase 4) | `requireAuth`. Cursor-paginated message history. |
|| `DELETE /conversations/:id/messages/:messageId` | ✅ New (Phase 4) | `requireAuth`. Ownership-checked soft delete. |
|| `POST /live/sessions` | ✅ New (Phase 5) | `requireAuth`. Create a live session (artist-only). |
|| `GET /live/sessions` | ✅ New (Phase 5) | List active live sessions. |
|| `GET /live/sessions/:id` | ✅ New (Phase 5) | Single session details. |
|| `POST /live/sessions/:id/end` | ✅ New (Phase 5) | `requireAuth`. End a live session (host-only). |
|| `GET /live/sessions/:id/chat` | ✅ New (Phase 5) | Chat history for a live session. |
|| `POST /live/sessions/:id/chat` | ✅ New (Phase 5) | `requireAuth`. Send a chat message in a live session. |
|| `GET /notifications` | ✅ New (Phase 6) | `requireAuth`. Cursor-paginated notifications inbox. |
|| `GET /notifications/unread-count` | ✅ New (Phase 6) | `requireAuth`. Unread notification count. |
|| `POST /notifications/:id/read` | ✅ New (Phase 6) | `requireAuth`. Mark single notification as read. |
|| `POST /notifications/read-all` | ✅ New (Phase 6) | `requireAuth`. Mark all notifications as read. |
|| `GET /notifications/prefs` | ✅ New (Phase 6) | `requireAuth`. Get notification preferences. |
|| `PATCH /notifications/prefs` | ✅ New (Phase 6) | `requireAuth`. Update per-type notification preferences. |
|| `POST /push/tokens` | ✅ New (Phase 6) | `requireAuth`. Register a push notification token. |
|| `DELETE /push/tokens` | ✅ New (Phase 6) | `requireAuth`. Unregister a push token. |

**Server-level gaps (updated after Phase 6):**

- ✅ ~~No `requireAuth` middleware~~ — **Done (Phase 0).** `requireAuth`, `optionalAuth`, `requireAdmin` middleware extracted to `lib/jwt`. Inline auth checks replaced across all routes.
- ✅ ~~No rate limiting~~ — **Done (Phase 0).** Per-route `express-rate-limit` on auth endpoints (login, register, OTP). Per-route mounting (not router-level) to avoid firing on unrelated routes.
- ❌ No input validation framework — most routes do ad-hoc `typeof x === "string"` checks instead of using `@workspace/api-zod`. (Profile update enhanced with bio/genre/coverColor in Phase 2. Social endpoints use inline validation.)
- ✅ ~~No WebSocket / real-time layer~~ — **Done (Phase 4).** Socket.io with JWT-in-handshake auth. Events: `conversation:new`, `conversation:message`, `conversation:updated` (Phase 4); `live:session:started`, `live:session:ended`, `live:chat:message` (Phase 5); `notification:new` (Phase 6).
- ✅ ~~No central error handler~~ — **Done (Phase 0).** Central error handler + consistent `{code, message}` shape.
- ❌ No request ID surfacing to clients.
- ✅ ~~No tests~~ — **Done (Phase 0).** JWT unit tests, auth middleware tests, auth integration tests (register→login→me→401). Vitest harness + healthz smoke test. Phase 3 added social + mentions tests.
- ✅ ~~No CI~~ — **Done (Phase 0).** GitHub Actions: lint → typecheck → build → test (with Postgres 16 service).
- ✅ ~~CORS accepts all origins~~ — **Done (Phase 0).** CORS allow-listed.
- ⚠️ `JWT_SECRET` falls back to a hardcoded dev string when unset in non-production.
- ✅ ~~GCS sidecar dependency~~ — **Removed (Phase 2).** `ObjectStorageService`, `objectAcl.ts`, `uploadRegistry.ts` deleted. Replaced by `StorageProvider` interface in `lib/storage/` with `R2Adapter` (audio) + `SupabaseStorageAdapter` (images) + `MemoryStorageAdapter` (dev/CI fallback).

### 1.4 Mobile App (`artifacts/campus-music-mobile/`)

The entry point (`app/index.tsx`) now checks for a stored token and redirects unauthenticated users to `/onboarding/welcome` (Phase 0 auth gate).

**Tab navigation** (`app/(tabs)/_layout.tsx`):
- Visible: Home, Discover, Library, Connect, Vibe (= Discover variant), Profile
- Hidden routes used as deep links / modals: Social, Upload, Trending

| Screen | Status | What it does / where it cheats |
|---|---|---|
| `(tabs)/index.tsx` (Home) | ✅ Done (Phase 3) | Rewritten to fetch from `GET /feed` (cursor-paginated). Renders real `PostCard` components with real engagement counts (like/comment/repost/share). Pull-to-refresh + infinite scroll + compose FAB. `LIVE_ARTISTS` strip kept hardcoded (Phase 5 replaces). |
| `(tabs)/discover.tsx` | ⚠️ | Real `/search` integration. `NOW_LISTENING_USERS`, `CAMPUS_PODCASTS`, `TRENDING_COUNTRIES` are hardcoded constants. |
| `(tabs)/library.tsx` | ✅ | Real `getLikedTrackIds` + `getLibraryTrackIds`. |
| `(tabs)/connect.tsx` | ✅ | Real `getConnections`, `searchConnections`, send/respond mutations. |
| `(tabs)/social.tsx` | ⚠️ | Real feed + artists; **marks top 1/3 of artists "live" by follower count** (no actual live state). |
| `(tabs)/upload.tsx` | ✅ | Full GCS flow: `request-url` → `PUT` to presigned URL → `POST /tracks`. Uses `expo-document-picker` for audio + `expo-image-picker` for cover. |
| `(tabs)/profile.tsx` | ✅ | Real `getMe`, artist tracks, `updateMe`, `updateTrack`, `deleteTrack`. |
| `(tabs)/trending.tsx` | ✅ | Real `/tracks/trending`. |
| `(tabs)/real-connections.tsx` | ✅ | Variant on connect.tsx — real API. |
| `live.tsx` | ✅ Done (Phase 5) | Rewritten: real `GET /live/sessions` + Socket.io `/live` namespace for chat + presence. Host UI (start/end broadcast), listener UI (join, chat). |
| `messages.tsx` | ✅ Done (Phase 4) | Rewritten against real `GET /conversations` + `GET /conversations/:id/messages`. Socket.io real-time delivery. |
| `music-feed.tsx` | ✅ Done (Phase 3) | Real tracks + real comments via `GET /comments?targetType=track&targetId=xxx`. Submit, like, delete comments via real API. One-level replies. |
| `player.tsx` | ✅ | Real `PlayerContext`; cross-device resume via `/playback`. |
| `profile/[id].tsx` | ✅ Done (Phase 3) | Real `/users/:id` + Posts section via `GET /users/:id/posts` rendered with `PostCard`. |
| `artist/[id].tsx` | ✅ | Real `/artists/:id` + tracks. |
| `genres.tsx` / `campuses.tsx` | ✅ | Real `/tracks?genre=` / `?university=`. |
| `most-liked.tsx` | ✅ | Real `/tracks/most-liked`. |
| `onboarding/welcome → role → email → name → university → country → password → otp → notifications → follow` | ⚠️ | Real OTP API (in-memory), real `register`, real `followArtist`. **`notifications` screen is pure UI** — no `expo-notifications` dependency exists; "Allow Notifications" just navigates forward. |
| `onboarding/login.tsx` | ✅ | Real `/auth/login`. |

**Mobile-level gaps:**

- ✅ ~~No auth gate~~ — **Done (Phase 0).** `app/index.tsx` checks token, redirects to `/onboarding/welcome` if missing.
- ✅ ~~No push notification system~~ — **Done (Phase 6).** `expo-notifications` installed. Push registration in onboarding. Expo Push Service backend integration. Notification preferences UI (per-type toggles). Bell-icon inbox screen with live unread badge.
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
| Lint | ✅ ESLint flat config: typescript-eslint + react/hooks + react-native + drizzle (Phase 0) |
| Format | ✅ Prettier configured (`.prettierrc.json`), Husky pre-commit via lint-staged (Phase 0). `format:check` not yet in CI. |
| Typecheck | ✅ `pnpm run typecheck` works (workspace `tsc --build`) |
| Tests | ✅ Vitest harness + JWT/auth/integration tests (Phase 0) |
| CI | ✅ GitHub Actions: lint → typecheck → build → test with Postgres 16 service (Phase 0) |
| Migrations | ✅ `drizzle-kit generate` + checked-in SQL migrations in `lib/db/migrations/` (Phase 0) |
| Env | ⚠️ Per-artifact `.env` files (gitignored). API requires `DATABASE_URL`; mobile uses `EXPO_PUBLIC_API_URL` |
| Deployment | ⚠️ `.replit` autoscale + Dockerfile added (Phase 0) — no Fly/Vercel deploy yet |
| Secrets | ⚠️ JWT secret has insecure dev fallback |
| Object storage | ✅ Done (Phase 2) | `StorageProvider` interface + `R2Adapter` (audio) + `SupabaseStorageAdapter` (images) + `MemoryStorageAdapter` (dev/CI). GCS sidecar removed. |

---

## 2. MVP Roadmap (per feature area)

> Every feature already visible in the mobile UI ships for MVP. No cuts. Trade is on timeline (§4) and on features that aren't promised by the UI at all (§5).

### 2.1 Auth

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| Email + password signup | ✅ | – | P0 | – |
| Login | ✅ | – | P0 | – |
| JWT issuance | ✅ | – | P0 | – |
| ~~**`requireAuth` middleware**~~ | ✅ Done (Phase 0) | – | P0 | – |
| ~~**Auth gate in mobile app**~~ | ✅ Done (Phase 0) | – | P0 | – |
| ~~**Refresh-token rotation**~~ | ✅ Done (Phase 1) | – | P0 | – |
| ~~**Real email verification**~~ | ✅ Done (Phase 1) | – | P0 | – |
| ~~**Password reset flow**~~ | ✅ Done (Phase 1) | – | P0 | – |
| ~~**Rate limit auth endpoints**~~ | ✅ Done (Phase 0) | – | P0 | – |
| Role-based onboarding (artist vs listener branches) | ✅ | – | P0 | – |
| ~~**Logout that actually invalidates the refresh token**~~ | ✅ Done (Phase 1) | – | P0 | – |
| OAuth (Google / Apple sign-in) | ❌ | M | – | Post-MVP (§5) |
| 2FA / TOTP | ❌ | M | – | Post-MVP (§5) |

### 2.2 Artist Profile

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| Bio (read + edit) | ✅ Done (Phase 2) | – | P0 | `PATCH /auth/me` enhanced with bio/genre/coverColor. |
| Avatar / cover photo upload | ✅ Done (Phase 2) | – | P0 | `POST /users/me/avatar` — multipart → sharp 3-size → Supabase Storage. |
| Track uploads | ✅ | – | P0 | – |
| ~~**Multi-bitrate audio transcoding on upload**~~ | ✅ Done (Phase 2) | – | P0 | `apps/transcoder/` Fly worker: ffmpeg → 96k/160k/320k AAC. `tracks.audioUrls` jsonb map. |
| ~~**Audio served via CDN with signed URLs**~~ | ✅ Done (Phase 2) | – | P0 | `StorageProvider.getSignedReadUrl` + optional `AUDIO_CDN_URL`/`IMAGE_CDN_URL`. |
| Edit track / delete track | ✅ | – | P0 | – |
| Follower count | ✅ | – | P0 | – |
| ~~**Followers list (who follows me)**~~ | ✅ Done (Phase 2) | – | P0 | `GET /artists/:id/followers` cursor-paginated. |
| **Artist analytics: plays / likes / saves / new followers over time** | ❌ | M | P1 | `play_history` table |
| **Track ordering / pin to top** | ❌ | S | P1 | – |
| **Public artist URL / share sheet** | ❌ | S | P1 | deep links |

### 2.3 Listener Profile

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| Liked tracks | ✅ | – | P0 | – |
| Followed artists | ✅ | – | P0 | – |
| ~~**Listening history**~~ (recently played) | ✅ Done (Phase 2) | – | P0 | `play_history` table + `GET /me/history` endpoint. |
| Saved-to-library | ✅ | – | P0 | – |
| ~~**Listener bio + avatar**~~ | ✅ Done (Phase 2) | – | P0 | Same `POST /users/me/avatar` endpoint works for all users. |

### 2.4 Live Now — real live audio + chat

The current `live.tsx` is fully simulated. We build it for real. **No "redefine as passive listening" cop-out** — Live Now is a marquee feature and ships as live.

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| ~~**Live audio streaming**~~ (artist broadcasts low-latency audio to N listeners) | ✅ Done (Phase 5) | L | P0 | Socket.io-based audio presence. LiveKit integration deferred (needs credentials). |
| ~~**`live_sessions` table**~~ | ✅ Done (Phase 5) | S | P0 | Migration 0010. Columns: id, hostUserId, status, startedAt, endedAt, description, thumbnailUrl, viewerCount. |
| ~~**`POST /live/sessions` / `GET /live/sessions` / `POST /live/sessions/:id/end`**~~ | ✅ Done (Phase 5) | M | P0 | Plus `GET /live/sessions/:id`, `GET/POST /live/sessions/:id/chat`. |
| **Server-issued LiveKit access tokens** | ⚠️ Deferred | M | P0 | LiveKit secrets needed. Adapter pattern ready. |
| ~~**Listener join + leave (presence) tracking**~~ | ✅ Done (Phase 5) | M | P0 | Socket.io `/live` namespace. |
| ~~**Real-time chat during a live session**~~ | ✅ Done (Phase 5) | M | P0 | Socket.io `live:chat:message` events. |
| ~~**`live_chat_messages` table**~~ + history fetch | ✅ Done (Phase 5) | S | P0 | `live_chat_messages` table + `GET /live/sessions/:id/chat`. |
| ~~**"Currently live" tile on Home + Social tabs**~~ | ✅ Done (Phase 5) | S | P0 | Real `live_sessions` query. |
| **Listening Now strip** (who's currently playing what) | ❌ | M | P1 | `play_history` w/ `lastListenedAt` index |
| ~~**Push notification when an artist you follow goes live**~~ | ✅ Done (Phase 6) | S | P1 | Notification trigger wired in Phase 6. |
| ~~**Mobile UI rewrite of `live.tsx`**~~ | ✅ Done (Phase 5) | M | P0 | Host UI + listener UI + chat. |
| **Save a live session as a track** (post-broadcast publish) | ❌ | M | P0 | LiveKit composite egress → ffmpeg → R2 → `tracks` row. Needs LiveKit credentials. |

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
| ~~**`posts` table**~~ | ✅ Done (Phase 3) | – | P0 | `posts` table with `type` column (original/repost/quote), `originalPostId` FK, soft delete via `deletedAt`. |
| ~~**`POST /posts` / `GET /posts/:id` / `DELETE /posts/:id`**~~ | ✅ Done (Phase 3) | – | P0 | Full CRUD with `requireAuth` + `requireVerified`. Ownership-checked soft delete. |
| ~~**`GET /feed`**~~ | ✅ Done (Phase 3) | – | P0 | Rewritten: cursor-paginated posts from followed artists + connections + self, global fallback on sparse page. |
| ~~**Mobile: rebuild Home tab**~~ | ✅ Done (Phase 3) | – | P0 | `PostCard` components with real engagement. Pull-to-refresh + infinite scroll + compose FAB. |
| ~~**Compose post screen**~~ | ✅ Done (Phase 3) | – | P0 | `compose-post.tsx` — text input, quote-post support. Track/image attach toolbar visual-only (deferred). |
| ~~**Pagination**~~ (cursor-based) | ✅ Done (Phase 3) | – | P0 | Cursor = `createdAt` ISO timestamp. `{ items, nextCursor }` response shape. |
| **Image attachments on posts** | ⚠️ | M | P1 | `attachedImageUrl` column exists; upload UX deferred. |
| ~~**Mentions + hashtags**~~ in post body (parse + clickable) | ✅ Done (Phase 3) | – | P1 | `extractMentions` / `extractHashtags` at write time. `RichText` component linkifies on mobile. |

### 2.6 Comments, Likes, Shares, Reposts

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| ~~**`comments` table**~~ (polymorphic) | ✅ Done (Phase 3) | – | P0 | `targetType` (post/track) + `targetId`. No DB FK (validated in app). One-level nesting via `parentCommentId`. Soft delete. |
| ~~**Comment endpoints**~~ | ✅ Done (Phase 3) | – | P0 | `POST /comments`, `GET /comments?targetType=&targetId=`, `DELETE /comments/:id`. Eager replies (max 3). |
| ~~**Comments on tracks**~~ | ✅ Done (Phase 3) | – | P0 | `music-feed.tsx` rewritten to use `GET /comments?targetType=track`. |
| ~~**Comments on posts**~~ | ✅ Done (Phase 3) | – | P0 | Post detail screen (`post/[id].tsx`) with full comment thread. |
| ~~**Nested replies (one level deep)**~~ | ✅ Done (Phase 3) | – | P1 | Enforced: if `parentCommentId` is set, parent must be top-level. |
| ~~**`post_likes` table** + endpoints~~ | ✅ Done (Phase 3) | – | P0 | `post_likes` + `comment_likes` with UNIQUE constraint. Toggle endpoints return `{ liked, likeCount }`. |
| ~~**Wire real post-like + comment-like into mobile**~~ | ✅ Done (Phase 3) | – | P0 | `PostCard` engagement bar + per-comment like toggle with optimistic state. |
| ~~**Delete broken `POST /feed/:id/like`**~~ | ✅ Done (Phase 0) | – | P0 | Removed in Phase 0 (commit 8cb7ee0). Superseded by `POST /posts/:id/like`. |
| ~~**`post_shares` table**~~ | ✅ Done (Phase 3) | – | P0 | Repeatable shares (no UNIQUE). `POST /posts/:id/share` returns `{ shareCount, shareUrl }`. |
| ~~**Reposts**~~ | ✅ Done (Phase 3) | – | P0 | Reposts are `posts` rows with `type='repost'` + `originalPostId` (not a separate table). 409 on duplicate. Unrepost via soft delete. |
| ~~**Quote-post**~~ | ✅ Done (Phase 3) | – | P1 | Posts with `type='quote'` + `originalPostId`. Compose screen accepts `?quotePostId=`. |

### 2.7 Notifications

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| ~~**`notifications` table**~~ | ✅ Done (Phase 6) | S | P0 | Migration 0011. Columns: id, userId, type, actorId, targetType, targetId, data, read, createdAt, updatedAt. |
| ~~**In-app notifications inbox**~~ (bell icon) | ✅ Done (Phase 6) | M | P0 | Full inbox screen with live unread badge on Home bell. |
| ~~**Triggers**~~: new follower, post like, comment, DM, connection accepted, live started | ✅ Done (Phase 6) | M | P0 | Notification service with trigger hooks wired into all upstream events. |
| ~~`GET /notifications`~~ / `POST /notifications/:id/read` / `POST /notifications/read-all` | ✅ Done (Phase 6) | S | P0 | Plus `GET /notifications/unread-count`, `GET/PATCH /notifications/prefs`. |
| ~~**Push notifications**~~ (Expo Push) | ✅ Done (Phase 6) | M | P0 | `push_tokens` table. Expo Push Service integration (best-effort). |
| ~~**Connect onboarding/notifications screen**~~ to request permission + register token | ✅ Done (Phase 6) | S | P0 | Push registration in onboarding. `POST/DELETE /push/tokens`. |
| ~~**Notification preferences UI**~~ (per-type toggles) | ✅ Done (Phase 6) | M | P1 | Per-type toggles sheet. `users.notifPrefs` (jsonb). |
| **Email digest** (weekly summary of activity while away) | ❌ | M | P1 | Email provider (§3.1) |

### 2.8 Discovery

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| Tracks by genre | ✅ | – | P0 | – |
| Tracks by university | ✅ | – | P0 | – |
| Followed artists | ✅ | – | P0 | – |
| **Full-text search across tracks + artists + universities + users + podcasts** | ⚠️ | M | P0 | Today: full table scan + JS `.includes()`. Switch to Postgres `to_tsvector` + GIN index. |
| Search users (listeners + artists) as a top-level result | ⚠️ | S | P0 | Promoted from `/connections/search` |
| ~~**Trending tracks (last 7d)**~~ | ✅ Done (Phase 2) | – | P0 | Rewritten to 7-day rolling window from `play_history`. |
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
| ~~**`conversations` table**~~ | ✅ Done (Phase 4) | S | P0 | Migration 0009. Columns: id, type, createdAt, updatedAt, lastMessageAt. |
| ~~**`conversation_participants`**~~ | ✅ Done (Phase 4) | S | P0 | conversationId, userId, joinedAt, lastReadAt. |
| ~~**`messages` table**~~ | ✅ Done (Phase 4) | S | P0 | id, conversationId, senderId, body, type, trackId, imageUrl, createdAt, updatedAt, deletedAt. |
| ~~**REST endpoints**~~: list conversations, fetch messages (paginated), send message, delete message | ✅ Done (Phase 4) | M | P0 | `POST/GET /conversations`, `GET /conversations/:id`, `POST/GET /conversations/:id/messages`, `DELETE /conversations/:id/messages/:messageId`. |
| ~~**WebSocket channel**~~ for real-time message delivery | ✅ Done (Phase 4) | M | P0 | Socket.io events: `conversation:new`, `conversation:message`, `conversation:updated`. |
| ~~**Mobile UI rewrite of `messages.tsx`**~~ | ✅ Done (Phase 4) | L | P0 | Real `GET /conversations` + `GET /conversations/:id/messages`. Socket.io real-time delivery. |
| ~~**Conversation creation from a profile**~~ | ✅ Done (Phase 4) | S | P0 | `POST /conversations` with participantIds. |
| **Attach a track / image to a DM** | ❌ | M | P1 | Storage + WS |
| ~~**Push notification on new message when app is backgrounded**~~ | ✅ Done (Phase 6) | S | P0 | DM notification trigger wired in Phase 6. |
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
| ~~**Admin role on `users`**~~ | ✅ Done (Phase 0) | – | P0 | `is_admin` boolean, baked into JWT |
| ~~**`requireAdmin` middleware**~~ | ✅ Done (Phase 0) | – | P0 | – |
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
| ~~**Replace Replit GCS sidecar**~~ | ✅ Done (Phase 2) | – | P0 | `StorageProvider` + R2 + Supabase Storage + Memory fallback |
| ~~**Avatar upload endpoint**~~ (`POST /users/me/avatar`) | ✅ Done (Phase 2) | – | P0 | multipart → sharp 3-size → Supabase Storage |
| ~~**Rate limiting**~~ | ✅ Done (Phase 0) | – | P0 | – |
| **Central validation** with `@workspace/api-zod` everywhere | ⚠️ | M | P0 | – |
| ~~**Foreign keys + indexes**~~ | ✅ Done (Phase 0) | – | P0 | – |
| **`createdAt` / `updatedAt`** on every table | ⚠️ Partial (Phase 0) | S | P0 | Added to tracks, user_likes, user_connections, user_playback. Missing on users, user_library. |
| ~~**Real SQL migrations**~~ | ✅ Done (Phase 0) | – | P0 | – |
| ~~**Error normalization**~~ | ✅ Done (Phase 0) | – | P0 | – |
| ~~**CORS allow-list**~~ | ✅ Done (Phase 0) | – | P0 | – |
| ~~**Health checks**~~ | ✅ Done (Phase 0) | – | P0 | – |
| **WebSocket gateway** (`socket.io` on the Express server; auth via JWT in the handshake) — used by DMs + Live chat | ❌ | M | P0 | §3.7 |
| **Tests** — integration tests for auth, tracks, posts, DMs, live session lifecycle | ⚠️ Auth tests done (Phase 0); rest pending | L | P1 | – |

### 2.14 Infrastructure

| Item | Status | Effort | Priority | Depends on |
|---|---|---|---|---|
| ~~**CI workflow**~~ | ✅ Done (Phase 0) | – | P0 | – |
| ~~**ESLint config**~~ | ✅ Done (Phase 0) | – | P0 | – |
| ~~**Prettier config**~~ | ✅ Done (Phase 0) | – | P0 | – |
| **Hosting decision** (Fly.io for API + Vercel for admin SPA — see §3.4) | ❌ | M | P0 | – |
| **Production Postgres** (Supabase is already provisioned; verify connection limits + pgBouncer) | ⚠️ | S | P0 | – |
| ~~**Production object storage**~~ (R2 + Supabase Storage — see §3.3) | ✅ Done (Phase 2) | – | P0 | `StorageProvider` + adapters implemented. Provision R2/Supabase env vars for prod. |
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
| ~~**`pgvector` extension + `track_embeddings`**~~ (CLAP, 512-dim) | ✅ Schema done (Phase 2) | – | P0 | Schema + HNSW index created. Inference deferred to Phase 12 ai-worker. |
| **Stems separation on upload** (Demucs, stored alongside master in R2) | ⚠️ Schema done (Phase 2) | M | P0 | `tracks.stemUrls` column added. Inference deferred to Phase 12 ai-worker. |
| ~~**Structured lyrics**~~ (`lyrics_lines` + `lyrics_embeddings`) | ✅ Schema done (Phase 2) | – | P0 | Tables created. LRC upload + Whisper auto-fallback deferred to Phase 12. |
| ~~**`ai_jobs` queue table**~~ + future `ai-worker` Fly app slot | ✅ Schema done (Phase 2) | – | P0 | Table created. Transcoder queues embedding + stems jobs after transcode. |
| ~~**`ai_generations` lineage table**~~ (provenance) | ✅ Schema done (Phase 2) | – | P0 | – |
| ~~**`users.ai_consent` JSON**~~ (granular opt-in per AI feature) | ✅ Schema done (Phase 2) | – | P0 | `ai_consent` jsonb column added (default '{}'). |
| ~~**`users.ai_credits` + `ai_credit_ledger`**~~ | ✅ Schema done (Phase 2) | – | P0 | `ai_credits` integer on users + `ai_credit_ledger` table. |
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

### 3.1 Email provider — DONE (Phase 1)

- **Resolved: Resend.** `@workspace/email` package with `EmailService` interface + `ResendAdapter` (prod) + `ConsoleAdapter` (dev/CI fallback). Singleton based on `RESEND_API_KEY` env var. Templates for OTP and password-reset emails. Resend v6 installed. Domain verification + `RESEND_API_KEY` provisioning are user responsibilities when ready for real email send.

### 3.2 Admin app strategy

- **Options:** (a) Build admin into `artifacts/campus-music` (existing Vite shell), (b) Build inside mobile app gated by role, (c) Build a new Next.js app, (d) Use Retool/Forest.
- **Recommendation: (a) — repurpose `artifacts/campus-music`.** It already has Tailwind, Radix UI, Wouter, React-Query, and the workspace's API client. The "splash screen only" state means nothing to throw away, and it gives admins a real desktop UI without polluting the mobile app. Avoid Next.js for now — adds build complexity we don't need for a CRUD dashboard.
- **Action item:** `lib/api-client-react` already exposes everything; add `requireAdmin`-gated screens (Users, Tracks, Posts, Comments, Flags, Live Sessions, Analytics, Broadcasts).

### 3.3 Object storage — DONE (Phase 2)

- **Resolved: Cloudflare R2 for audio + Supabase Storage for images.** `lib/storage/` workspace package with `StorageProvider` interface (6 methods: `getPresignedUploadUrl`, `getSignedReadUrl`, `deleteObject`, `objectExists`, `putBuffer`, `getBuffer`). Three adapters: `R2Adapter` (S3-compatible via `@aws-sdk/client-s3`), `SupabaseStorageAdapter` (via `@supabase/storage-js`), `MemoryStorageAdapter` (dev/CI fallback). Singleton exports `audioStorage` (R2 or Memory) + `imageStorage` (Supabase or Memory). CDN via optional `AUDIO_CDN_URL`/`IMAGE_CDN_URL`. GCS `ObjectStorageService` deleted entirely.

### 3.4 Hosting / deployment — **Fly.io for API (multi-region), Vercel for admin SPA**

- **Decision: Fly.io for the API + Vercel for the admin SPA.** Fly's anycast + persistent connections are required for the Socket.io gateway (DMs + live chat + notifications). At MVP we run two regions (e.g. `iad` + `lax`); add `lhr` / `fra` when international traffic justifies it.
- **Mobile** builds via Expo EAS (preview + production profiles).
- **Action item:** add `Dockerfile` to `artifacts/api-server`, `fly.toml` w/ `auto_stop_machines = false` + `min_machines_running = 1` per region, and `vercel.json` to `artifacts/campus-music`.

### 3.5 Artist data model: separate `artists` table or just a flag on `users`? — DONE (Phase 0)

- **Resolved:** `artists` table dropped. All artist fields (`bio`, `genre`, `coverColor`) moved onto `users`. Seeded `a1`…`a10` are now real `users` rows with `role=artist`, `is_system=true`, and a sentinel password (`!system-no-login`) that the login guard blocks before bcrypt. The virtual `user-<artistId>` hack is removed.

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

### 3.7 Real-time / WebSockets — DONE (Phase 4)

- **Resolved:** Socket.io gateway with JWT-in-handshake auth added in Phase 4. Namespaces: `/dms` (conversation:new, conversation:message, conversation:updated), `/live` (live:session:started, live:session:ended, live:chat:message — Phase 5), `/notifications` (notification:new — Phase 6). User rooms for targeted delivery. Sticky sessions via Fly's `fly-replay` header.
- **RealtimeGateway interface** implemented — adapter pattern for future swap to Ably / Pusher / PartyKit.

### 3.8 Rate limiting backend — STARTED (Phase 0)

- **Done:** in-memory `express-rate-limit` on auth endpoints (login, register, OTP) with per-route mounting (Phase 0).
- **Remaining:** extend to post creation, DM send, and other write endpoints in later phases. Upgrade to Redis when we scale beyond one API instance.

### 3.9 Migrations strategy — DONE (Phase 0)

- **Resolved:** Switched from `drizzle-kit push` to `drizzle-kit generate` + checked-in SQL migrations in `lib/db/migrations/`. Post-merge hook runs `pnpm db:migrate`. CI runs `migrate` against a fresh Postgres 16 service container. Baseline migration (`0000_init`) bootstraps from scratch; `0001_schema_hygiene` adds FKs, timestamps, and indexes.

### 3.10 Token strategy — DONE (Phase 1)

- **Resolved:** 15-min HS256 access JWT + 30-day refresh token stored in `refresh_tokens` table (SHA-256 hashed, family-based). Rotate refresh on every use; reuse detection revokes the entire family. `/auth/logout` revokes the family. `/auth/refresh` endpoint for rotation. Mobile 401 interceptor in `custom-fetch.ts` handles transparent refresh with de-duplication.

### 3.11 Admin authorization — DONE (Phase 0)

- **Resolved:** `users.is_admin` boolean added. `is_admin` baked into JWT claims (`{ sub, role, isAdmin, isSystem }`). `requireAdmin` middleware checks `req.auth.isAdmin === true`. Re-login required after admin flag changes.

### 3.12 Push notifications — DONE (Phase 6)

- **Resolved:** Expo Push Service integrated in Phase 6. `push_tokens` table stores device tokens. `POST /push/tokens` for registration, `DELETE /push/tokens` for unregistration. Backend sends push via Expo Push API (best-effort, graceful failure). `expo-notifications` installed in mobile app. Push registration in onboarding flow. Per-type notification preferences via `users.notifPrefs` (jsonb) + `GET/PATCH /notifications/prefs`.

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

### Phase 0 — Foundations (1 week) — COMPLETE

> **Merged:** PR #6 (21 commits, `chore/phase-0-foundations → main`). CI green.

- ✅ ESLint flat config + Prettier + Husky pre-commit + lint-staged.
- ✅ GitHub Actions CI: two-job pipeline (quality: lint→typecheck→build, test: vitest + Postgres 16).
- ✅ `requireAuth` / `optionalAuth` / `requireAdmin` middleware extracted to `lib/jwt`; inline auth checks replaced across all routes.
- ✅ Auth gate in mobile app (`app/index.tsx` checks token, redirects to `/onboarding/welcome`).
- ✅ `createdAt`/`updatedAt` on tracks, user_likes, user_connections, user_playback. (Still missing on `users` and `user_library`.)
- ✅ 9 FK constraints (ON DELETE CASCADE) + 3 indexes (`users(role)`, `tracks(artist_id)`, `tracks(created_at DESC)`).
- ✅ Switched to `drizzle-kit generate` + checked-in SQL migrations (`0000_init` baseline + `0001_schema_hygiene`).
- ✅ Collapsed `artists` table into `users` (§3.5). Seeded artists are now system users (`is_system`, sentinel password).
- ✅ Central error handler + CORS allow-list + DB-ping health check.
- ✅ `is_admin` / `is_system` flags on `users`, `requireAdmin` middleware, JWT claims baking (`sub`, `role`, `isAdmin`, `isSystem`).
- ✅ Per-route rate limiting on auth endpoints (login, register, OTP).
- ✅ JWT/auth unit tests + auth integration tests + Vitest harness.
- ✅ Multi-stage Dockerfile for API server.

**Effort:** ~5 dev-days. **Unblocks:** everything below.

### Phase 1 — Real Auth (1 week) — COMPLETE

> **Merged:** PR #8 (7 commits, `feature/phase-1-real-auth → main`). CI green.

- ✅ `@workspace/email` package: `EmailService` interface + `ResendAdapter` (prod) + `ConsoleAdapter` (dev/CI). Resend v6.
- ✅ Refresh-token rotation: `refresh_tokens` table (SHA-256 hashed, family-based reuse detection, 30-day TTL). JWT access token reduced from 30d → 15 minutes. `POST /auth/refresh` rotates. `POST /auth/logout` revokes the family.
- ✅ Password reset: `password_reset_tokens` table (1-hour TTL, single-use via atomic `usedAt` conditional update). `POST /auth/password/forgot` (rate-limited, no email enumeration) + `POST /auth/password/reset` (rate-limited, revokes all refresh tokens on success).
- ✅ Email verification gate: `emailVerified` boolean on `users` (default false). `requireVerified` middleware gates `POST /tracks`. `otp/verify` sets `emailVerified=true`. OTP send via `emailService` (devCode only in non-production).
- ✅ Mobile: 401 refresh interceptor in `custom-fetch.ts` (de-duped). `AuthContext` stores refresh token in SecureStore. Register-before-verify onboarding flow. Forgot/reset password screens. Upload tab shows verification gate.
- ✅ Integration tests: refresh rotation + reuse detection, password reset lifecycle, email verification gate + OTP flow.
- ✅ Migrations: 0002 (refresh_tokens), 0003 (password_reset_tokens), 0004 (email_verified).
- ✅ OpenAPI spec + generated client updated for all new endpoints.
- ~~Rate limiting on auth endpoints.~~ (Moved to Phase 0 — done.)
- ~~`is_admin` flag in users + JWT claims.~~ (Moved to Phase 0 — done.)

**Effort:** ~5 dev-days. **New env vars:** `RESEND_API_KEY` (optional), `EMAIL_FROM` (optional), `APP_BASE_URL`.

### Phase 2 — Profiles + Storage + Audio Pipeline + AI Foundations (2.5 weeks) — COMPLETE

> **Merged:** PR #10 (10 commits, `feature/phase-2-storage-audio-ai → main`). CI green.

- ✅ `lib/storage/` package: `StorageProvider` interface + `R2Adapter` (S3-compatible, zero-egress audio) + `SupabaseStorageAdapter` (images) + `MemoryStorageAdapter` (dev/CI fallback). Singletons `audioStorage`/`imageStorage`. CDN support via optional `AUDIO_CDN_URL`/`IMAGE_CDN_URL`.
- ✅ GCS `ObjectStorageService` deleted (256 lines). `routes/storage.ts` rewritten for R2 presigned URLs. Track media resolved via signed URLs at response time (`lib/trackMedia.ts`).
- ✅ `apps/transcoder/`: standalone Fly.io worker. Polls `upload_jobs` (FOR UPDATE SKIP LOCKED). ffmpeg → 96k/160k/320k AAC. sharp → 3-size cover art WebP. Uploads to R2. Queues `ai_jobs` for embedding + stems. SIGTERM graceful shutdown. Dockerfile: Node 22 + ffmpeg.
- ✅ Schema: `tracks.audioUrls`/`coverUrls`/`stemUrls` (jsonb) + `processingStatus` (default 'ready'). `upload_jobs` table with status+createdAt index.
- ✅ `play_history` table (full Spotify-class data shape) + `track_skips` table. `POST /tracks/:id/play` rewritten with per-listen telemetry. New `POST /tracks/:id/skip`, `GET /me/history`. Trending rewritten to 7-day rolling window.
- ✅ `POST /users/me/avatar` (multipart → sharp 3-size → Supabase Storage). `PATCH /auth/me` enhanced (bio/genre/coverColor). `GET /artists/:id/followers` (cursor-paginated).
- ✅ AI foundations schema: pgvector extension + `track_embeddings` (512-dim, HNSW cosine) + `lyrics_lines` + `lyrics_embeddings` (1536-dim) + `ai_jobs` + `ai_generations` + `ai_credit_ledger` + `users.aiCredits`/`aiConsent`. Schema only — no inference in Phase 2.
- ✅ Mobile: adaptive bitrate via `@react-native-community/netinfo` (`useBitrate` hook). Play/skip telemetry reporting.
- ✅ Migrations: 0005 (storage/transcoding), 0006 (play_history + track_skips), 0007 (AI + pgvector). CI uses `pgvector/pgvector:pg16`.
- ✅ OpenAPI spec + generated client updated for all new/changed endpoints.
- ✅ Tests: storage adapter unit tests + play telemetry integration tests + followers list tests.

**Effort:** ~12 dev-days. **New env vars:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `AUDIO_CDN_URL` (optional), `IMAGE_CDN_URL` (optional). None required for dev/CI (MemoryStorageAdapter fallback).

### Phase 3 — Music Feed + Comments + Likes + Shares + Reposts (2 weeks) — COMPLETE

> **Merged:** PR #12 (12 commits, `feature/phase-3-social-feed → main`). CI green.

- ✅ 5 new tables: `posts` (with `type` column for original/repost/quote + `originalPostId` FK + soft delete), `comments` (polymorphic `targetType + targetId`, one-level nesting), `post_likes` + `comment_likes` (UNIQUE constraint), `post_shares` (repeatable, no UNIQUE).
- ✅ Posts CRUD: `POST /posts` (requireAuth + requireVerified), `GET /posts/:id` (optionalAuth), `DELETE /posts/:id` (ownership-checked soft delete), `GET /users/:id/posts` (cursor-paginated).
- ✅ Feed rewrite: `GET /feed` cursor-paginated with follows + connections + self + global fallback. Batched `shapePosts` helper (no N+1): author, signed tracks, engagement counts, `hasLiked`/`hasReposted`, embedded `originalPost`.
- ✅ Comments: `POST /comments`, `GET /comments?targetType=&targetId=` (eager replies max 3), `DELETE /comments/:id`. Batched `shapeComments` helper.
- ✅ Likes: `POST /posts/:id/like` + `POST /comments/:id/like` toggle endpoints. UNIQUE constraint prevents duplicates.
- ✅ Shares: `POST /posts/:id/share` (repeatable). Reposts: `POST /posts/:id/repost` (409 on duplicate) + `DELETE /posts/:id/unrepost` (soft delete).
- ✅ Mentions + hashtags: `extractMentions`/`extractHashtags` utility. `RichText` component linkifies @mentions → profile, #hashtags → search.
- ✅ Mobile: Home tab rewrite (real `GET /feed` + `PostCard` + pull-to-refresh + infinite scroll + compose FAB). Compose post screen (text + quote support). Post detail screen (comments + replies + inline composer). Profile posts section. Track comments rewrite (`music-feed.tsx` wired to real API).
- ✅ Migration: `0008_social_posts.sql` — all 5 tables + indexes.
- ✅ OpenAPI spec + generated client updated (13 new operations).
- ✅ Tests: INTEGRATION-gated full-surface social tests (post lifecycle, comments, likes, shares, reposts, empty-post rejection, cross-user delete rejection) + DB-free mention/hashtag unit tests.

**Effort:** ~10 dev-days. **No new env vars.**


### Phase 4 — WebSocket Gateway + Direct Messages — COMPLETE ✅

**PR:** [#15](https://github.com/KofiGilbert/campus-music-app/pull/15) (merged)

Deliverables shipped:
- Socket.io gateway added to `api-server` with JWT-in-handshake auth.
- Migration 0009: `conversations`, `conversation_participants`, `messages` tables with proper FKs, indexes, and constraints.
- REST endpoints: `POST /conversations`, `GET /conversations`, `GET /conversations/:id`, `POST /conversations/:id/messages`, `GET /conversations/:id/messages`, `DELETE /conversations/:id/messages/:messageId`.
- Socket.io namespace `/dms` — events: `conversation:new`, `conversation:message`, `conversation:updated`.
- Mobile `messages.tsx` rewritten against real API + Socket.io real-time delivery.
- Conversation creation from profile via `POST /conversations` with `participantIds`.
- OpenAPI spec + client regenerated.
- Integration tests for DM lifecycle.

Deferred: track/image attachments in DMs (P1).

### Phase 5 — Live Now (real audio + chat) — COMPLETE ✅

**PR:** [#16](https://github.com/KofiGilbert/campus-music-app/pull/16) (merged)

Deliverables shipped:
- Migration 0010: `live_sessions` (id, hostUserId, status, startedAt, endedAt, description, thumbnailUrl, viewerCount), `live_chat_messages` tables.
- REST endpoints: `POST /live/sessions`, `GET /live/sessions`, `GET /live/sessions/:id`, `POST /live/sessions/:id/end`, `GET /live/sessions/:id/chat`, `POST /live/sessions/:id/chat`.
- Socket.io namespace `/live` — events: `live:session:started`, `live:session:ended`, `live:chat:message`. Presence tracking.
- Mobile `live.tsx` rewritten: host UI (start/end broadcast), listener UI (join, chat).
- "Currently live" tile on Home from real `live_sessions` query.
- OpenAPI spec + client regenerated.
- Integration tests for live session lifecycle.

Deferred: LiveKit audio transport (needs credentials), live→track auto-publish (needs LiveKit composite egress).

### Phase 6 — Notifications (in-app + push) — COMPLETE ✅

**PR:** [#17](https://github.com/KofiGilbert/campus-music-app/pull/17) (merged)

Deliverables shipped:
- Migration 0011: `notifications` table (id, userId, type, actorId, targetType, targetId, data, read, createdAt, updatedAt), `push_tokens` table, `users.notifPrefs` (jsonb).
- Notification service: persist + Socket.io `notification:new` event + Expo Push (best-effort).
- Trigger hooks wired into: follow, post like, comment, DM, connection accepted, live session started.
- REST endpoints: `GET /notifications` (cursor-paginated inbox), `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET /notifications/prefs`, `PATCH /notifications/prefs`, `POST /push/tokens`, `DELETE /push/tokens`.
- Mobile: full notifications inbox screen, per-type preferences sheet, push registration in onboarding, live unread badge on Home bell icon.
- `expo-notifications` installed. Push registration flow in onboarding.
- OpenAPI spec + client regenerated.
- Integration tests for notification lifecycle.

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

| Phase | Theme | Effort | Status |
|---|---|---|---|
| 0 | Foundations | 1 week | **COMPLETE** |
| 1 | Real Auth | 1 week | **COMPLETE** |
| 2 | Profiles + Storage + Audio Pipeline + **AI Foundations** (R2 + CDN + transcoder + embeddings + stems + lyrics) | 2.5 weeks | **COMPLETE** |
| 3 | Music Feed + Social Graph (comments/likes/shares/reposts) | 2 weeks | **COMPLETE** |
| 4 | WebSocket Gateway + Direct Messages | 2 weeks | **COMPLETE** |
| 5 | Live Now (real audio + chat) | 2.5 weeks | **COMPLETE** |
| 6 | Notifications (in-app + push) | 1.5 weeks | **COMPLETE** |
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

*Phases 0–6 shipped. Continuing one phase at a time, with a PR per phase. Soft-launch target: ~12 calendar weeks from kickoff (2 engineers, parallel where possible).*
