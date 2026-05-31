# CLAUDE_ROADMAP.md — Operating Manual for Claude Code on Campus Music

> **You are the implementation partner. Devin is the architect/reviewer. Kofi is the product owner.** This file is your operating manual. `DEVIN_ROADMAP.md` is the product + architectural roadmap (the *what*); this file is the *how*.

---

## 0. Sources of truth (read both before writing any code)

1. **`DEVIN_ROADMAP.md`** — the full product + architectural roadmap. Codebase audit, MVP plan (Phases 0–11.5), post-MVP AI track (Phases 12–17), §6 decisions table. The source of truth for **scope**.
2. **`CLAUDE_ROADMAP.md`** (this file) — workflow, code-quality rules, definition of done, what NOT to do without approval, tech stack reference. The source of truth for **how**.

If those two files disagree with each other, or with the codebase, **stop and flag it on the relevant PR**. Do not silently pick one.

---

## 1. Project context (one paragraph)

Campus Music is a Spotify × TikTok/Instagram hybrid for college campus artists. Two user types (artists + listeners). Built as a pnpm monorepo with three artifacts (`api-server`, `campus-music-mobile`, `campus-music` legacy web → admin SPA) and four libs (`db`, `api-spec`, `api-client-react`, `api-zod`). Postgres (Supabase) in an isolated `campus_music` schema. The quality bar is **Spotify- / Apple-Music-class artist discovery + AI-native from the schema up**. Everything else lives in `DEVIN_ROADMAP.md`.

---

## 2. Workflow — non-negotiable

**One phase at a time. PR per phase. No exceptions.**

For each phase:

1. Read the matching section of `DEVIN_ROADMAP.md` (Phase 0, Phase 1, etc.).
2. Branch from `main`: `claude/phase-<N>-<short-name>` (e.g. `claude/phase-0-foundations`).
3. Implement the phase. Land each logical chunk in its own commit.
4. Open a PR titled `Phase <N>: <short summary>`. Use the repo's PR template.
5. Wait for Devin's review **and** green CI.
6. Address feedback in **new commits** — never amend or force-push.
7. When merged, immediately open the next phase's branch from `main`.

**Do not start a new phase before the previous one is merged.**

### Definition of done for every phase

- All items listed for that phase in `DEVIN_ROADMAP.md` are implemented.
- `pnpm lint` passes with zero warnings.
- `pnpm typecheck` passes.
- `pnpm test` passes; tests added for new functionality.
- All new endpoints documented in the OpenAPI spec (`lib/api-spec`) and reflected in the generated client (`lib/api-client-react`).
- All new DB tables backed by versioned SQL migrations in `lib/db/migrations/` — **never** `drizzle-kit push` in production.
- CI green on the PR.
- Mobile preview build passes: `eas build --profile preview` on iOS + Android.
- Manual smoke test of the new feature on iOS + Android + web (record evidence in the PR).
- README or relevant doc updated if behavior changed.
- Migration runs cleanly against a fresh DB and against a copy of staging.

---

## 3. Approved decisions (locked in by Kofi)

| Area | Decision |
|---|---|
| **Storage** | Cloudflare R2 for audio + Supabase Storage for images. Both behind Cloudflare CDN with signed URLs. |
| **Audio** | Multi-bitrate AAC (96k / 160k / 320k) via ffmpeg worker on Fly.io. **P0.** |
| **Live Now** | LiveKit Cloud (interactive WebRTC audio). Live → MP3 auto-publish at session end is **P0**. |
| **Campus Music TV** | Cloudflare Stream (RTMPS → HLS broadcast) with auto-VOD. See DEVIN_ROADMAP.md §3.6 + §3.17. |
| **Hosting** | Fly.io for API (multi-region: `iad` + `lax`) + Vercel for admin SPA. Migrate **off Replit** during Phase 1. |
| **Realtime** | Socket.io on Fly.io, behind a `RealtimeGateway` interface (future swap to Ably / PartyKit). |
| **Email** | Resend with DKIM + SPF + DMARC on the real `campus-music.app` domain. |
| **Email-verify gating** | Posting / uploading / commenting / DMs / starting a live session = **blocked** until email verified. Browsing / liking / following = **open**. |
| **Migrations** | Versioned SQL migration files only. **No `drizzle-kit push` in production**. |
| **Artists table** | Collapse into `users`. Seeded `a1`–`a10` become real `users` rows with `role=artist` + `is_system=true`. Drop the `artists` table. |
| **Admins** | Just Kofi initially. CLI: `pnpm admin:promote <email>` to flip `is_admin`. |
| **Podcasts** | Any user with `role=artist` can create a podcast. No new role. |
| **AI foundations** | Bake into Phase 2 (Layer A of §3.19): pgvector + audio embeddings + stems separation + structured lyrics + `ai_jobs` + provenance + consent + credits + safety classifier. |
| **AI features** | Phases 12–17 (Layer B of §3.19), post-MVP. |
| **AI providers** | Pluggable `AIProvider` interface. Defaults: Anthropic Claude (text/chat), Stability AI / FAL (image), Suno / MusicGen (music gen), OpenAI Whisper (STT), Demucs (stems, on our own GPU worker). Never lock in. |
| **AI credits** | 50 free generations/month per artist. Ledger structure ships in MVP Phase 2. Paywall + Stripe top-ups activate in Phase 12. |
| **AI provenance** | Mandatory. SynthID on audio, C2PA on images. Visible "Made with AI" badge on every AI-assisted asset. |
| **AI consent** | Granular per-feature opt-in (collab AI, mashups, translate-and-cover). Default = opt-out. Revocable, audited. |
| **Cross-Campus Collab Studio** | Phase 14. The moat. |
| **AI A&R Weekly Brief** | Phase 15. Weekly cadence (Sunday). |
| **Mobile distribution** | TestFlight + Internal Play for the first 2 weeks of soft launch. Public listings after telemetry settles. |

**Anything not in this table → defer to `DEVIN_ROADMAP.md`.** Anything not in either → flag and ask.

---

## 4. Code quality rules

### TypeScript

- `strict: true` everywhere.
- **No `any`.** No `as` casts without a comment justifying them.
- Shared types live in `lib/db` (schema-derived) and `lib/api-zod` (request/response).
- Server validates every input with Zod. Never trust request bodies.

### React Native / Expo

- Functional components only.
- `useEffect` cleanup is non-optional when subscribing.
- React Query (Tanstack) for all server state. No raw `fetch` in screens.
- Every screen has loading + error states. No undefined-checks scattered around.
- React Native components must work on iOS, Android, **and** `react-native-web`.

### Express

- Route files are **thin**. Business logic in `services/`. DB queries via Drizzle inline or in `repositories/` when complex.
- `requireAuth` middleware (Phase 0 deliverable) on every authenticated route. No more inlined token checks.
- Every route returns a typed JSON envelope.
- A single error-handling middleware returns a consistent error shape.

### Database

- All schema changes via versioned SQL migrations in `lib/db/migrations/YYYYMMDDHHMM_short_name.sql`.
- `drizzle-kit generate` produces the SQL; you review, adjust, and commit the file.
- Every table has `id`, `created_at`, and (where mutated) `updated_at`.
- Every foreign key column has an index unless explicitly justified.
- All migrations have an explicit down migration.
- Migrations must run cleanly against a fresh DB **and** against a snapshot of production.

### File / module layout

- New code follows existing patterns. If you're inventing a new pattern, flag it in the PR description and discuss before merging.

### Tests

- Integration tests for new endpoints (Vitest + Supertest hitting in-process Express).
- Unit tests for new pure functions.
- Mobile tests are smoke-level (Maestro or Detox) — can defer broad coverage to Phase 11 hardening, but write component snapshots for non-trivial logic.

### Security

- **Never commit secrets.** `.env.example` for shape; real secrets via Fly secrets / Vercel env / Expo EAS secrets.
- Every user input validated, sanitized, escaped.
- Auth: JWT signed with a real secret — **no dev-fallback secret in production**. Refresh tokens in DB with rotation on use.
- Rate limit every auth + write endpoint.
- CORS allow-list, not wildcard.
- All AI-generated assets carry provenance metadata (SynthID / C2PA where supported).

### Git

- Commits: imperative present tense, max 72-char subject. Body explains the *why*, not the *what*.
- Branch naming: `claude/phase-<N>-<short-name>`, `claude/fix/<short-name>`, `claude/chore/<short-name>`.
- PR descriptions reference the roadmap section being delivered.
- **Never force-push** a branch that has been reviewed.

---

## 5. What you DO NOT do without approval

- **Schema changes** outside the planned ones for the current phase. Flag and discuss.
- **Vendor / provider swaps** (Resend → SES, R2 → S3, etc.). Approved providers are in §3.
- **Scope additions** to the current phase. If you find a missing item, flag it in the PR and either include it (small) or defer (large).
- **Breaking changes** to the API contract without versioning the endpoint.
- **Removing or renaming** anything user-facing without explicit approval.
- **Skipping CI** with `[skip ci]` or pushing directly to `main`.
- **Force pushes** on any branch under review.
- **Mass refactors** unrelated to the current phase.
- **AI model / prompt changes** that affect user-facing outputs without Devin's sign-off.

When in doubt → **ask Devin first**. If Devin doesn't have an opinion → ask Kofi.

---

## 6. When (and how) to flag blockers

Flag **immediately** as a PR comment, or open a separate GitHub issue tagged `blocker`:

- Missing credentials / secrets for an external service.
- An item in `DEVIN_ROADMAP.md` that depends on a decision not in §3 above.
- A schema conflict you can't resolve.
- A CI failure you can't reproduce locally.
- A vendor API behaving unexpectedly.
- Any case where you'd need to deviate from `DEVIN_ROADMAP.md` to make progress.

**Do not silently work around blockers.** Better to wait + ask than to introduce a hack.

---

## 7. Tech stack reference — do not change without approval

| Layer | Stack |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 (`strict: true`) |
| Package manager | pnpm workspaces (catalog + Linux-only native overrides) |
| API server | Express 5 |
| ORM | Drizzle ORM 0.45 |
| Database | Postgres (Supabase) — isolated `campus_music` schema |
| Vector DB | pgvector (same Postgres) |
| Mobile UI | React 19.1 + Expo 54 + React Native + react-native-web |
| Server state | React Query (Tanstack) |
| Styling | Tailwind v3 (mobile) + Tailwind v4 (admin) — do **not** unify; each artifact stays on its own |
| Auth | JWT via `jose` + bcryptjs |
| Tests | Vitest |
| Observability | Sentry + PostHog |
| API host | Fly.io (multi-region: `iad` + `lax`) |
| Admin host | Vercel |
| Audio CDN | Cloudflare R2 + Cloudflare CDN |
| Live audio | LiveKit Cloud |
| Live video (Campus Music TV) | Cloudflare Stream |
| Realtime | Socket.io |
| Email | Resend |
| Push | Expo Notifications + APNs + FCM |
| Payments | Stripe (later, for AI credit top-ups) |
| AI inference | Anthropic, OpenAI Whisper, Stability AI / FAL, Suno / MusicGen, Demucs (own GPU) |

pnpm catalog versions are pinned. Do **not** bump versions in a non-Phase-11 PR.

---

## 8. Phase plan (mirror of DEVIN_ROADMAP.md §4)

For full details on each phase, read the corresponding section of `DEVIN_ROADMAP.md`. This is just the ordering reference:

| # | Phase | Effort |
|---|---|---|
| 0 | Foundations | 1 week |
| 1 | Real Auth (incl. migrate off Replit) | 1 week |
| 2 | Profiles + Storage + Audio Pipeline + **AI Foundations** | 2.5 weeks |
| 3 | Music Feed + Comments + Likes + Shares + Reposts | 2 weeks |
| 4 | WebSocket Gateway + Direct Messages | 2 weeks |
| 5 | Live Now (LiveKit + Live → MP3 auto-publish) | 2.5 weeks |
| 6 | Notifications (in-app + push) | 1.5 weeks |
| 7 | Discovery overhaul (FTS + Now Listening + Trending) | 1.5 weeks |
| 8 | Podcasts | 1.5 weeks |
| 9 | Playlists | 1 week |
| 10 | Admin Web | 1.5 weeks |
| 10.5 | Campus Music TV (Cloudflare Stream + scheduled shows + chat + auto-VOD) | 2 weeks |
| 11 | Production Hardening + soft launch | 1.5 weeks |
| --- | **MVP COMPLETE** (~21.5 weeks) | --- |
| 12 | AI Foundations harden + ai-worker + Recs v1 | 2 weeks |
| 13 | Studio Assistants (Pen Pal + Cover Studio + Beat Lab + Demo Polish) | 3 weeks |
| 14 | **Cross-Campus Collab Studio "Sessions"** (the moat) | 3 weeks |
| 15 | AI A&R Weekly Brief + Ask Campus + Lyric Tagging + Recs v2 | 2 weeks |
| 16 | AI Karaoke + Mashup Studio + Translate-and-Cover + Cover Detection | 2 weeks |
| 17 | AI Campus Music TV Producer + Live Captions + Edge AI + Trend Prediction | 2 weeks |

---

## 9. Phase 0 starting checklist (your first PR)

Open branch `claude/phase-0-foundations` immediately after this docs PR merges. Deliverables (from `DEVIN_ROADMAP.md` Phase 0 + this section, exhaustive):

- **ESLint + Prettier** config across the monorepo: `typescript-eslint` + `eslint-plugin-react` + `eslint-plugin-react-native` + `eslint-plugin-drizzle`. Apply zero-warning policy.
- **Husky** + **lint-staged** pre-commit hook running `eslint --fix` + `prettier --write` + `tsc --noEmit` on staged files.
- **GitHub Actions CI** workflow: `lint → typecheck → test → build` on every PR. Cache pnpm + Turbo. Postgres service container for migration tests.
- **`requireAuth` middleware** in `api-server`, applied to every authenticated route. Delete every inlined token-check. Add `requireAdmin` variant.
- **Collapse `artists` into `users`**: SQL migration that copies seeded `a1`–`a10` rows into `users` with `role=artist`, `is_system=true`. Drop the `artists` table. Update all references in `api-server` + `lib/api-zod` + `campus-music-mobile`. Delete the virtual `user-<artistId>` hack.
- **Versioned SQL migrations infrastructure**: `lib/db/migrations/` directory, `pnpm db:migrate` command using `drizzle-kit migrate`, CI step that runs migrations against a fresh test DB.
- **Remove `drizzle-kit push`** from the post-merge hook and from production. Document the new workflow in `lib/db/README.md`.
- **Fly.io setup**: organization, app `campus-music-api`, `fly.toml` with regions `iad` + `lax`, secrets configured via `flyctl secrets set`. Manual `fly deploy` verified — health check returns 200, DB connectivity verified.
- **Cloudflare setup**: account, R2 bucket `campus-music-audio`, API token scoped to that bucket, connectivity test from `api-server` (`HEAD` on a test object).
- **Mobile auth gate**: rewrite `app/index.tsx` so unauthenticated users redirect to `/auth/sign-in` instead of straight into the tabs.
- **Delete the broken `POST /feed/:id/like`** endpoint — it's a no-op. Will be properly replaced by post-likes in Phase 3.
- **`is_admin` flag** added to `users`, included in JWT claims. CLI script `pnpm admin:promote <email>` that flips the flag (with confirmation prompt).
- **Rate limiting** on `/auth/*` endpoints via `express-rate-limit` (Redis-backed if Redis is already in the stack; in-memory fine for now).
- **Pre-commit hook** installed via Husky; verify it fires on a sample commit.
- **Open a PR** titled `Phase 0: Foundations`. Use the repo's PR template. Wait for Devin's review + green CI. Address review in new commits. Do not force-push.

When this PR merges, immediately open `claude/phase-1-real-auth` and start Phase 1.

---

## 10. Roles — who owns what

- **You (Claude Code):** implementation. Code, tests, migrations, infra-as-code (`fly.toml`, GHA workflows), per-phase docs.
- **Devin (architect / reviewer):** code review on every PR, architectural decisions outside §3, schema reviews, security reviews, AI/ML strategy, performance reviews. Session URL: https://app.devin.ai/sessions/db416d2861a3475195e36b318e3b0c05.
- **Kofi (product owner):** product calls, scope changes, secrets + credentials provisioning, vendor approvals, final say.

When in doubt about who owns a decision → **ask Devin first**. If Devin doesn't have an opinion → ask Kofi.

---

*Welcome aboard. Read DEVIN_ROADMAP.md cover to cover. Then come back and re-read this. Then open the Phase 0 branch.*
