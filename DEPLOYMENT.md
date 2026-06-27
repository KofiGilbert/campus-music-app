# Deployment & Provisioning Runbook (Phase 11)

This is the hands-on checklist to take Campus Music from merged code to a running
soft launch. The code + infra-as-code are in the repo; the steps below need
accounts, secrets, and a human (Kofi) — they cannot run in CI/sandbox.

## 0. Database migrations (run first, every deploy)

Migrations `0000`–`0015` live in `lib/db/migrations/`. Apply against staging,
then production:

```bash
DATABASE_URL=postgresql://… corepack pnpm@11.9.0 --filter @workspace/db run migrate
```

Verify against a fresh DB and a staging snapshot before prod (CI already runs the
chain against a clean Postgres on every PR).

## 1. API → Fly.io (`artifacts/api-server`)

`fly.toml` + `Dockerfile` are committed (regions: `iad` primary; add `lax`).

```bash
fly launch --no-deploy           # once, links the app campus-music-api
fly secrets set \
  DATABASE_URL=… JWT_SECRET=… \
  R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=… R2_ENDPOINT=… CLOUDFLARE_ACCOUNT_ID=… \
  SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  RESEND_API_KEY=… EMAIL_FROM=… APP_BASE_URL=… \
  LIVEKIT_API_KEY=… LIVEKIT_API_SECRET=… LIVEKIT_WS_URL=… \
  CLOUDFLARE_STREAM_TOKEN=… CLOUDFLARE_CUSTOMER_SUBDOMAIN=… \
  EXPO_ACCESS_TOKEN=… SENTRY_DSN=… ALLOWED_ORIGINS=https://admin.campus-music.app
fly regions add lax && fly scale count 2 --region iad,lax
fly deploy                       # health check: GET /api/healthz → 200
```

## 2. Admin SPA → Vercel (`artifacts/campus-music`)

`vercel.json` is committed (Vite build + SPA rewrite). In the Vercel project:
set **Root Directory = `artifacts/campus-music`** and env **`VITE_API_URL`** =
the Fly API origin. Deploy. Add the deployed origin to the API `ALLOWED_ORIGINS`.

## 3. Mobile → Expo EAS (`artifacts/campus-music-mobile`)

`eas.json` defines `development` / `preview` / `production` profiles.

```bash
eas login
eas build --profile preview --platform ios      # + android
# Provision EAS secrets: EXPO_PUBLIC_SENTRY_DSN, EXPO_PUBLIC_POSTHOG_KEY
eas build --profile production --platform all
eas submit --profile production                 # TestFlight + Internal Play
```

For native Sentry source-maps, add the `@sentry/react-native/expo` config plugin
to `app.json` and the `SENTRY_ORG`/`SENTRY_PROJECT` EAS env (JS-level crash
capture already works without it).

## 4. Credentials checklist (gated features come alive when set)

| Secret(s) | Unlocks | Until set |
|---|---|---|
| `DATABASE_URL`, `JWT_SECRET` | everything | required |
| `R2_*`, `SUPABASE_*` | audio + image storage | Memory adapter (dev) |
| `RESEND_API_KEY` | real email | console adapter |
| `LIVEKIT_*` | Live Now audio + live→track | token endpoint 503s; sessions/chat work |
| `EXPO_ACCESS_TOKEN` | push receipts/limits | push still sends |
| `CLOUDFLARE_STREAM_TOKEN`, `CLOUDFLARE_CUSTOMER_SUBDOMAIN` | Campus Music TV streaming | dev-stub ingest/VOD |
| `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` | crash reporting | no-op |
| `EXPO_PUBLIC_POSTHOG_KEY` | analytics | no-op |

## 5. Load test

```bash
k6 run -e BASE_URL=https://campus-music-api.fly.dev scripts/k6/feed-load.js
```

Socket.io gateway load needs a Socket.io-aware tool (artillery-engine-socketio) —
follow-up.

## 6. Backups

Enable Supabase point-in-time recovery (paid tier) and run one restore drill
against a throwaway project before launch.

## 7. Promote an admin

```bash
corepack pnpm@11.9.0 admin:promote <email>
```
