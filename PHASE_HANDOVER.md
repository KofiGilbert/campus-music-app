# Phase Handover: Autonomous Completion Guide

> **Context:** Phases 0-3 were completed with Devin as architect/reviewer and Claude Code as implementer. From Phase 4 onward, Claude Code operates autonomously — implementing, self-reviewing, creating PRs, and updating docs. This document captures the established patterns and conventions from Phases 0-3 so Claude can maintain consistency.

---

## 1. Established Codebase Conventions

### Schema patterns

- **Namespace:** All tables use `campusMusic.table(...)` from `lib/db/src/schema/namespace.ts`. This schema-qualifies all SQL as `campus_music.*`.
- **Primary keys:** `varchar("id").primaryKey().default(sql\`gen_random_uuid()\`)` (UUID strings, not serial integers).
- **Timestamps:** `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()`. Always `WITH TIME ZONE`.
- **Soft deletes:** Use `deletedAt` column (nullable timestamp) where appropriate (posts, comments). Filter with `isNull(table.deletedAt)` in queries.
- **Foreign keys:** Always specify `onDelete` behavior. CASCADE for ownership (user deletes cascade to their content). SET NULL for optional references (track deleted, post keeps existing). Every FK column gets an index.
- **Self-referencing FKs:** Use `(): AnyPgColumn => table.id` pattern (see `posts.originalPostId`, `comments.parentCommentId`).
- **Schema file per table:** Each table gets its own file in `lib/db/src/schema/` (e.g., `posts.ts`, `comments.ts`). Export from `index.ts`.
- **Type exports:** Export `type TableName = typeof tableName.$inferSelect` from each schema file.
- **Index naming:** Descriptive, e.g., `index("posts_author_created_idx").on(t.authorUserId, t.createdAt.desc())`.

### Migration patterns

- **Numbering:** Sequential `NNNN_short_name.sql`. Next migration is `0009`. Keep the journal in `lib/db/migrations/meta/_journal.json` with strictly increasing timestamps.
- **Generation:** Use `drizzle-kit generate` to produce SQL, then review and commit. Never `drizzle-kit push` against production.
- **pgvector:** Migration 0007 established `CREATE EXTENSION IF NOT EXISTS vector`. The CI uses `pgvector/pgvector:pg16` Docker image.
- **Schema changes per phase:** Group related changes into one migration per logical unit. Phase 2 used 3 migrations (0005, 0006, 0007). Phase 3 used 1 migration (0008). Use your judgment.

### Route patterns

- **Middleware composition:** `requireAuth` (401 if no valid JWT), `requireVerified` (403 if `emailVerified` is false, queries DB), `optionalAuth` (sets `req.userId` if token present, continues if not), `requireAdmin` (403 if not admin).
- **Write endpoints:** `[requireAuth, requireVerified]` for creating content (posts, comments, tracks, uploads).
- **Read endpoints:** `optionalAuth` for public content that may show personalized data (feed, post detail — `hasLiked`, `hasReposted`).
- **Admin endpoints:** `[requireAuth, requireAdmin]`.
- **Router pattern:** Each route file creates `const router: IRouter = Router()`, exports `default router`. Registered in `app.ts` with `/api` prefix.
- **Response shape:** JSON objects. Lists use `{ items: [...], nextCursor?: string }` for cursor pagination. Errors use the central error handler's shape.

### Cursor pagination

- **Cursor value:** `createdAt` ISO timestamp string. Client sends `?cursor=2025-01-01T00:00:00.000Z&limit=20`.
- **Query:** `WHERE createdAt < cursor ORDER BY createdAt DESC LIMIT limit + 1`. If result length > limit, pop last item and set `nextCursor` to the last included item's `createdAt`.
- **Helper functions:** Each route file defines `parseLimit(value)` (default 20, max 50) and `parseCursor(value)` (returns Date or null).

### Batched shapers (N+1 prevention)

- **Pattern:** `shapePosts(rows, viewerId?)` and `shapeComments(rows, viewerId?)` in `lib/postShape.ts` / `lib/commentShape.ts`. They batch-fetch all authors, like counts, `hasLiked` flags, original posts, etc. in parallel `Promise.all` calls.
- **Extend this pattern** for new features: DMs should have a `shapeMessages`, notifications a `shapeNotifications`, etc.

### Test patterns

- **Location:** `artifacts/api-server/src/__tests__/`.
- **Framework:** Vitest + Supertest.
- **Integration gate:** `const integration = process.env.INTEGRATION === "1"`. Use `describe.runIf(integration)("...", () => { ... })` for DB-dependent tests.
- **DB-free unit tests:** Run unconditionally (no `runIf`). Test pure functions (mention extraction, token hashing, etc.).
- **Helper:** `registerVerified(role)` — registers a user, sends OTP, verifies OTP, returns `{ token, userId }`. Mock email with `vi.spyOn(emailService, "sendEmail").mockResolvedValue(undefined)`.
- **Unique emails:** `const uniq = (p: string) => \`ci-${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test\`;`

### Mobile patterns

- **State management:** React Query for server state. `useQuery` / `useMutation` with proper `queryKey` arrays.
- **API client:** Generated from OpenAPI spec via orval. Import from `@workspace/api-client-react`.
- **Auth:** `AuthContext` stores access + refresh tokens in SecureStore. `custom-fetch.ts` handles 401 → refresh → retry.
- **Optimistic updates:** Like toggles, etc. use optimistic state in the UI component, then reconcile with server response.
- **Screen layout:** Expo Router file-based routing. `app/(tabs)/` for main tabs, `app/` for modal/detail screens.

### OpenAPI + client generation

- **Spec location:** `lib/api-spec/openapi.yaml`.
- **All new endpoints** must be documented in the spec with request/response schemas.
- **Regenerate client:** `pnpm --filter @workspace/api-client-react generate` (orval).
- **Recursive schemas** are fine (Post.originalPost, Comment.replies).

### CI

- **Two jobs:** "Lint, typecheck & build" + "Test (Postgres)".
- **Postgres service:** `pgvector/pgvector:pg16` image with `POSTGRES_PASSWORD=test`, `POSTGRES_DB=campus_music_test`.
- **Integration tests:** Run with `INTEGRATION=1` env var.
- **Verify locally before pushing:** `pnpm lint && pnpm typecheck && pnpm test`.

---

## 2. Phase-by-Phase Design Notes

These are concise implementation notes for each remaining phase. The full scope is in `DEVIN_ROADMAP.md` §4. These notes fill in the architectural decisions that Devin would have provided as design decisions documents.

### Phase 4 — WebSocket Gateway + Direct Messages

**Branch:** `feature/phase-4-dms`

**Schema (migration 0009):**
- `conversations` — id (UUID PK), type ('direct' | 'group'), createdAt, updatedAt. Index on createdAt.
- `conversation_participants` — id (UUID PK), conversationId (FK CASCADE), userId (FK CASCADE), joinedAt, lastReadAt. UNIQUE(conversationId, userId). Index on userId.
- `messages` — id (UUID PK), conversationId (FK CASCADE), senderUserId (FK CASCADE), body (text, NOT NULL), attachedTrackId (FK SET NULL), attachedImageUrl (text), createdAt, deletedAt (soft delete). Index on (conversationId, createdAt DESC).

**Socket.io setup:**
- Install `socket.io` in api-server. Attach to the existing HTTP server.
- JWT-in-handshake auth: client sends `{ auth: { token: "Bearer ..." } }`, server verifies JWT in `io.use()` middleware. Set `socket.data.userId`.
- Create a `RealtimeGateway` interface (per §3 approved decisions) wrapping Socket.io, so it can be swapped later.
- Namespace `/dms` for DM events: `message:new`, `message:deleted`, `typing:start`, `typing:stop`, `conversation:read`.
- Join socket rooms by `conversation:${id}` on connection (for all user's conversations).

**REST endpoints:**
- `GET /conversations` — requireAuth. List user's conversations with last message + unread count. Cursor-paginated.
- `GET /conversations/:id/messages` — requireAuth. Participant-checked. Cursor-paginated messages.
- `POST /conversations/:id/messages` — requireAuth + requireVerified. Send message. Emit socket event to room.
- `POST /conversations` — requireAuth + requireVerified. Create/find 1:1 conversation with another user.
- `POST /conversations/:id/read` — requireAuth. Mark conversation as read (update lastReadAt).
- `DELETE /messages/:id` — requireAuth. Ownership-checked soft delete.

**Mobile:**
- Rewrite `messages.tsx` to use real API + WebSocket.
- "Message" button on `profile/[id].tsx` → create/find conversation → navigate to chat.
- Chat screen: message list (FlatList, inverted), text input, typing indicator, read receipts.
- Unread badge on Messages tab.

**Env vars:** None new (Socket.io runs on the same server).

**Tests:** Conversation creation, message send/receive, read receipts, participant access control, soft delete.

---

### Phase 5 — Live Now (real audio + chat + live->track publish)

**Branch:** `feature/phase-5-live-now`

**Schema (migration 0010):**
- `live_sessions` — id (UUID PK), hostUserId (FK CASCADE), title, status ('scheduled' | 'live' | 'ended'), transport ('livekit'), scheduledAt, startedAt, endedAt, listenerCount (integer, default 0), egressId (text), publishedTrackId (FK SET NULL → tracks), createdAt. Index on (status, createdAt).
- `live_chat_messages` — id (UUID PK), sessionId (FK CASCADE), userId (FK CASCADE), body (text), createdAt. Index on (sessionId, createdAt).

**LiveKit integration:**
- `@livekit/server-sdk` — generate room tokens (host = publish + subscribe, listener = subscribe only).
- Server endpoints: `POST /live/sessions` (create room), `POST /live/sessions/:id/token` (get join token), `POST /live/sessions/:id/end` (end session, trigger egress).
- LiveKit webhook receiver: `POST /webhooks/livekit` for egress completion callback.

**Live -> MP3 auto-publish:**
- On session end, start LiveKit composite egress → outputs audio file to R2.
- When egress completes (webhook), queue an `upload_jobs` entry for the existing transcoder to create 96k/160k/320k variants.
- Insert a new `tracks` row linked to the artist, set `publishedTrackId` on the session.

**Socket.io namespace `/live/:sessionId`:**
- Chat messages, listener join/leave presence, listener count updates.

**Mobile:**
- `live.tsx` rewrite: host UI (start/end broadcast with `@livekit/react-native`), listener UI (join, chat, see listeners).
- "Currently live" tile on Home from real `live_sessions WHERE status='live'`.

**Env vars:** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Dev/CI: mock LiveKit calls (no real WebRTC needed for tests).

---

### Phase 6 — Notifications (in-app + push)

**Branch:** `feature/phase-6-notifications`

**Schema (migration 0011):**
- `notifications` — id (UUID PK), userId (FK CASCADE), type (text: 'follow' | 'like' | 'comment' | 'repost' | 'mention' | 'dm' | 'live' | 'connection_request' | 'connection_accepted'), actorUserId (FK SET NULL), targetType (text), targetId (text), body (text), readAt (timestamp), createdAt. Index on (userId, createdAt DESC), (userId, readAt).
- `push_tokens` — id (UUID PK), userId (FK CASCADE), token (text, UNIQUE), platform ('ios' | 'android'), createdAt. Index on userId.
- `notification_preferences` — userId (FK CASCADE, PK), mutedTypes (jsonb, default '[]'). Stores array of muted notification types.

**Notification triggers:** Insert notifications + send push in relevant route handlers:
- New follower, post like, comment, repost, mention, DM (new message in conversation), live session start, connection request/accepted.
- Use a `notifyUser(userId, { type, actorUserId, targetType, targetId, body })` helper that inserts the row and optionally sends push.

**Endpoints:**
- `GET /notifications` — requireAuth. Cursor-paginated. Include actor user shape.
- `POST /notifications/read` — requireAuth. Mark all as read (or specific IDs).
- `POST /push-tokens` — requireAuth. Register device token.
- `DELETE /push-tokens/:token` — requireAuth. Unregister.
- `GET /notifications/preferences` / `PATCH /notifications/preferences` — requireAuth.

**Push:** Expo Push API (`expo-server-sdk`). Batch sends. Handle receipt errors (invalid token → delete from push_tokens).

**Mobile:**
- `expo-notifications` permission flow in onboarding.
- Bell icon on Home tab header with unread count badge.
- Notifications screen (FlatList, pull-to-refresh, mark as read on view).
- Tap notification → deep link to relevant screen (post, profile, conversation, live session).
- Notification preferences screen (per-type toggles).

---

### Phase 7 — Discovery overhaul

**Branch:** `feature/phase-7-discovery`

**Schema (migration 0012):**
- `search_index` — materialized view combining tracks + users + posts (title/name/body → tsvector). GIN index + `pg_trgm` for fuzzy. Refresh via cron or on-demand.

**SearchProvider interface:**
- `SearchProvider` with methods: `search(query, { type, limit, offset })`. `PostgresFTSAdapter` implements it. Easy swap to Algolia/OpenSearch later.

**Endpoints:**
- `GET /search?q=&type=tracks|artists|users|posts` — optionalAuth. Faceted results. Uses `ts_rank` for relevance.
- `GET /now-listening` — recent `play_history` entries from followed users (what are people listening to right now).
- `GET /tracks/trending?by=country|university&value=US|MIT` — aggregates from `play_history` with geographic/university filters.

**Mobile:**
- Search screen rewrite with debounced input + faceted results (tabs: All, Tracks, Artists, Posts).
- "Now Listening" row on Home/Discover backed by real data.
- Trending by Country / by University sections on Discover.
- Simple "For You" rail: tracks liked by users you follow + same-university trending.

---

### Phase 8 — Podcasts

**Branch:** `feature/phase-8-podcasts`

**Schema (migration 0013):**
- `podcasts` — id (UUID PK), hostUserId (FK CASCADE), title, description, coverUrl, category, createdAt, updatedAt. Index on hostUserId.
- `podcast_episodes` — id (UUID PK), podcastId (FK CASCADE), title, description, audioUrl, audioUrls (jsonb), duration, episodeNumber, publishedAt, createdAt. Index on (podcastId, episodeNumber).
- `podcast_subscriptions` — id (UUID PK), userId (FK CASCADE), podcastId (FK CASCADE), createdAt. UNIQUE(userId, podcastId).

**Endpoints:** CRUD for podcasts (artist-only create), episode upload (reuse transcoder flow), subscribe/unsubscribe, list episodes.

**Mobile:** Podcast detail screen, episode player (reuse PlayerContext), subscribe button, Discover grid.

---

### Phase 9 — Playlists

**Branch:** `feature/phase-9-playlists`

**Schema (migration 0014):**
- `playlists` — id (UUID PK), userId (FK CASCADE), name, description, coverUrl, isPublic (boolean, default true), createdAt, updatedAt. Index on userId.
- `playlist_tracks` — id (UUID PK), playlistId (FK CASCADE), trackId (FK CASCADE), position (integer), addedAt. UNIQUE(playlistId, trackId). Index on (playlistId, position).

**Endpoints:** CRUD, add/remove/reorder tracks, auto-generated "Liked Songs" wrapper.

**Mobile:** Library tab playlist list, playlist detail, "Add to playlist" bottom sheet from track menu.

---

### Phase 10 — Admin Web

**Branch:** `feature/phase-10-admin`

Build out `artifacts/campus-music/` (the Vite SPA) as an admin dashboard:
- Layout shell with sidebar nav, login (admin role-gated JWT).
- Pages: Users (ban/unban, search, verify), Tracks (takedown), Posts (delete) + comment moderation, Flags/reports queue, Live sessions monitor, Analytics (DAU, signups, uploads, plays, DMs, live sessions per day), Push broadcast tool.

**Schema (migration 0015):**
- `flags` — id (UUID PK), reporterUserId (FK CASCADE), targetType ('post' | 'comment' | 'track' | 'user' | 'message'), targetId, reason (text), status ('pending' | 'reviewed' | 'actioned'), reviewedBy (FK SET NULL → users), reviewedAt, createdAt.

**Mobile:** "Report" option in post/comment/track action menus → `POST /flags`.

---

### Phase 10.5 — Campus Music TV

**Branch:** `feature/phase-10.5-campus-tv`

Cloudflare Stream integration. See `DEVIN_ROADMAP.md` §3.6 + §3.17 for full spec.

**Schema (migration 0016):**
- `shows` — id (UUID PK), title, description, status ('scheduled' | 'live' | 'ended'), hostUserId (FK), streamKey (encrypted), rtmpsUrl, hlsPlaybackUrl, vodAssetUrl, scheduledAt, dayOfWeek, timeUTC, timezone, startedAt, endedAt, viewerCount, createdAt.
- `show_chat_messages` — id (UUID PK), showId (FK CASCADE), userId (FK CASCADE), body, createdAt.
- `show_reminders` — id (UUID PK), showId (FK CASCADE), userId (FK CASCADE), createdAt. UNIQUE(showId, userId).

Build `CloudflareStreamService`, REST endpoints, Socket.io namespace `/tv/:showId`, admin producer panel, mobile HLS player with chat overlay.

**Env vars:** `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

---

### Phase 11 — Production Hardening

**Branch:** `chore/phase-11-hardening`

- Sentry integration (API + mobile).
- Fly.io production deploy with `fly.toml` + health checks.
- Vercel deploy for admin SPA.
- EAS build profiles (preview + production).
- TestFlight + Internal Play track.
- Supabase backup/restore drill.
- Comprehensive integration test suite.
- Maestro mobile critical-flow tests.
- PostHog analytics events.
- k6 load tests for WebSocket gateway + feed query.

---

### Phases 12-17 — AI Track (Post-MVP)

These phases build on the AI foundations schema from Phase 2. Full specs are in `DEVIN_ROADMAP.md` §4 (Phases 12-17). Key notes:

- **Phase 12:** Spin out `apps/ai-worker/` (separate from transcoder). `AIProvider` interface + adapter implementations. Safety classifier. Stripe credits. Recs engine v1 (item-item collaborative filtering + embedding cosine similarity).
- **Phase 13:** Four Studio Assistants (Pen Pal, Cover Studio, Beat Lab, Demo Polish). All behind `ai_credits` ledger.
- **Phase 14:** Cross-Campus Collab Studio "Sessions" — the moat. AI matchmaker, collab room UI, key-matching, vocal placement, mastering.
- **Phase 15:** AI A&R Weekly Brief, "Ask Campus" conversational search, lyric sentiment tagging, Recs v2.
- **Phase 16:** AI Karaoke, Mashup Studio, Translate-and-Cover, Cover Detection.
- **Phase 17:** AI Clip Generator, auto-captions (Whisper), AI thumbnails, edge AI on mobile, trend prediction.

For each: follow the same pattern — branch, implement, test, PR, self-review, merge, doc PR.

---

## 3. Self-Review Checklist

Before merging each phase PR, verify:

- [ ] All items listed for the phase in `DEVIN_ROADMAP.md` are implemented.
- [ ] Schema matches: table names, column types, FKs, indexes, constraints match the spec.
- [ ] Routes follow conventions: correct auth middleware (`requireAuth`, `requireVerified`, `optionalAuth`), cursor pagination, proper error responses.
- [ ] No N+1 queries: batched shapers for any endpoint returning lists of items with related data.
- [ ] Soft deletes where specified (posts, comments, messages).
- [ ] OpenAPI spec updated with all new endpoints and schemas.
- [ ] Client regenerated (`pnpm --filter @workspace/api-client-react generate`).
- [ ] Integration tests added for all new endpoints (INTEGRATION=1 gated).
- [ ] Unit tests for pure functions.
- [ ] `pnpm lint` clean (only pre-existing warnings acceptable).
- [ ] `pnpm typecheck` clean.
- [ ] `pnpm test` passes.
- [ ] CI green on the PR.
- [ ] Migration journal timestamps strictly increasing.
- [ ] No new env vars required for dev/CI unless absolutely necessary (use fallback adapters).
- [ ] Scope boundaries respected: no feature creep beyond what's listed for the phase.

## 4. Post-Phase Doc PR Pattern

After each phase PR is merged, create a doc-only PR updating `DEVIN_ROADMAP.md`:

1. Branch: `docs/<timestamp>-phase-N-complete`
2. Update §1.2 schema table: add new tables, update table count.
3. Update §1.3 endpoint table: add new endpoints with status.
4. Update §1.4 mobile table: update screen statuses.
5. Update §2.x subsections: mark items as done.
6. Update §4 phase section: expand with deliverable list, mark COMPLETE.
7. Update phase summary table: add COMPLETE status.
8. Update footer: "Phases 0-N shipped".
9. Commit message: `docs: update DEVIN_ROADMAP.md to reflect Phase N completion`
10. PR title: `docs: update DEVIN_ROADMAP.md to reflect Phase N completion`

Previous doc PRs for reference: PR #7 (Phase 0), PR #9 (Phase 1), PR #11 (Phase 2), PR #13 (Phase 3).

---

*This handover document was created by Devin after completing Phases 0-3. Claude Code should treat `DEVIN_ROADMAP.md` as the authoritative scope reference and this document as the implementation conventions reference.*
