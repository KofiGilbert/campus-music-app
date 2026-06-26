# CLAUDE_ROADMAP.md — Operating Manual for Claude Code on Campus Music

> **You are the autonomous implementation partner.** Devin completed Phases 0-3 as architect/reviewer; from Phase 4 onward you operate independently. Kofi is the product owner. This file is your operating manual. `DEVIN_ROADMAP.md` is the product + architectural roadmap (the *what*); `PHASE_HANDOVER.md` contains established conventions and phase-by-phase design notes (the *how*).

---

## 0. Sources of truth (read both before writing any code)

1. **`DEVIN_ROADMAP.md`** — the full product + architectural roadmap. Codebase audit, MVP plan (Phases 0–11.5), post-MVP AI track (Phases 12–17), §6 decisions table. The source of truth for **scope**.
2. **`CLAUDE_ROADMAP.md`** (this file) — workflow, code-quality rules, definition of done, what NOT to do without approval, tech stack reference. The source of truth for **how**.
3. **`PHASE_HANDOVER.md`** — established conventions from Phases 0–3, phase-by-phase design notes (Phases 4–17), self-review checklist. The source of truth for **implementation patterns and architecture**.

If these files disagree with each other, or with the codebase, **stop and flag it on the relevant PR**. Do not silently pick one.

---

## 1. Project context (one paragraph)

Campus Music is a Spotify × TikTok/Instagram hybrid for college campus artists. Two user types (artists + listeners). Built as a pnpm monorepo with three artifacts (`api-server`, `campus-music-mobile`, `campus-music` legacy web → admin SPA) and four libs (`db`, `api-spec`, `api-client-react`, `api-zod`). Postgres (Supabase) in an isolated `campus_music` schema. The quality bar is **Spotify- / Apple-Music-class artist discovery + AI-native from the schema up**. Everything else lives in `DEVIN_ROADMAP.md`.

---

## 2. Workflow — non-negotiable

**One phase at a time. PR per phase. No exceptions.**

For each phase:

1. Read the matching section of `DEVIN_ROADMAP.md` (Phase 0, Phase 1, etc.).
2. Branch from `main` using the repo's [CONTRIBUTING.md §40-48](CONTRIBUTING.md) convention — pick the prefix that matches what the phase actually does:
   - `chore/` for tooling / refactor / infra-only phases (Phase 0, Phase 11 hardening).
   - `feature/` for new user-facing functionality (Phases 1–10.5, 12–17).
   - `fix/` for bug-fix-only follow-ups.
   - `docs/` for documentation-only PRs.

   Append `phase-<N>-<short-name>` after the prefix so the branch is self-describing. Example: Phase 0 → `chore/phase-0-foundations`. Phase 1 → `feature/phase-1-real-auth`.
3. Implement the phase. Land each logical chunk in its own commit.
4. Open a PR titled `Phase <N>: <short summary>`. Use the repo's PR template.
5. **Self-review:** Before opening the PR, review your own commits against `DEVIN_ROADMAP.md` and `PHASE_HANDOVER.md`. Verify schema, routes, tests, and migrations match the spec. Run through the self-review checklist in `PHASE_HANDOVER.md` §3.
6. Open the PR. Wait for **green CI**. Fix any failures in **new commits** — never amend or force-push.
7. When CI is green, **merge the PR** (no external approval needed — you are operating autonomously).
8. **Create a post-phase doc PR** updating `DEVIN_ROADMAP.md` to reflect the phase's completion. Follow the pattern documented in `PHASE_HANDOVER.md` §4 (see PRs #7, #9, #11, #13 for examples).
9. When the doc PR's CI is green, merge it. Then immediately open the next phase's branch from `main`.

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
- Branch naming: per CONTRIBUTING.md §40-48 — `feature/`, `fix/`, `chore/`, or `docs/` prefix, then a short kebab-case description (include `phase-<N>-...` for roadmap phases so the branch is self-describing).
- AI-assisted commits include the Co-Authored-By trailer required by CONTRIBUTING.md §97-103: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
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
- **AI model / prompt changes** that affect user-facing outputs without Kofi's sign-off.

When in doubt → **ask Kofi**.

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

## 9. Phases 0–3 — COMPLETE

Phases 0–3 have been implemented and merged:
- **Phase 0** (Foundations): PR #6 — ESLint, Prettier, CI, auth middleware, artists→users collapse, versioned migrations, Fly.io setup, mobile auth gate, admin flag.
- **Phase 1** (Real Auth): PR #8 — Refresh tokens, email verification (Resend + OTP), password reset, `requireVerified` middleware.
- **Phase 2** (Storage + Audio + AI Foundations): PR #10 — R2 + Supabase Storage adapters, audio transcoder worker, avatar upload, play history + skips, pgvector + AI schema.
- **Phase 3** (Social Feed): PR #12 — Posts (original/repost/quote), polymorphic comments, post/comment likes, shares, mentions/hashtags, feed rewrite, mobile UI.

Current migration count: 0000–0008 (9 migrations). Next migration starts at **0009**.

**Your next task is Phase 4.** Read `PHASE_HANDOVER.md` for design notes, then follow the workflow in §2 above.

---

## 10. Roles — who owns what

- **You (Claude Code):** implementation, self-review, PR creation + merge, post-phase doc PRs. You are the sole developer from Phase 4 onward.
- **Kofi (product owner):** product calls, scope changes, secrets + credentials provisioning, vendor approvals, final say.

When in doubt about a decision → **ask Kofi**. If a decision is already covered in `DEVIN_ROADMAP.md` §3 or `PHASE_HANDOVER.md`, follow what's documented.

---

*Phases 0–3 are done. Read DEVIN_ROADMAP.md, PHASE_HANDOVER.md, and this file. Then start Phase 4.*
