# Running Campus Music locally (Windows / PowerShell)

This guide gets the **mobile app** (`artifacts/campus-music-mobile`) and the
**API server** (`artifacts/api-server`) running on your own machine, without
Replit's proxy. The fastest path for a UI demo is running the mobile app in a
**web browser** (the app already bundles `react-native-web`).

> The app was built as a Replit prototype. Replit injected the database URL,
> object-storage paths, and the API domain automatically. Locally you provide
> the database and tell the app where the API lives — that's the whole job.

> 🛠️ **Hit an error?** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — it covers
> the Windows/pnpm/Metro/Supabase gotchas we already solved (stale bundles,
> esbuild binary, drive-letter SHA-1, Android `10.0.2.2`, schema isolation, …).

---

## Current state (already configured on this machine)

This repo is already wired up and verified working:

- **Database**: a Supabase project, with our 8 tables isolated in a dedicated
  **`campus_music`** Postgres schema (so they don't collide with the 40
  unrelated tables in `public`). The schema namespace is defined in
  [lib/db/src/schema/namespace.ts](lib/db/src/schema/namespace.ts); drizzle is
  scoped to it via `schemaFilter` in [lib/db/drizzle.config.ts](lib/db/drizzle.config.ts).
- **`.env` files** are created (and gitignored): `artifacts/api-server/.env`
  (`DATABASE_URL`, `PORT=8080`) and `artifacts/campus-music-mobile/.env`
  (`EXPO_PUBLIC_API_URL=http://localhost:8080`).
- **API** runs on `http://localhost:8080`, **web demo** on `http://localhost:8082`.

If that's all in place, you can skip to **Quick reference** at the bottom. The
sections below explain a from-scratch setup and the Windows-specific gotchas.

---

## ⚠️ Windows build prerequisites (important)

This repo was built for Replit (Linux) and its `pnpm-workspace.yaml` deliberately
strips all non-Linux native binaries (esbuild, rollup, lightningcss, …). On
Windows two of these bite you, with non-obvious errors — here's how they were
resolved:

1. **esbuild has no Windows binary.** Both `db push` (drizzle-kit) and the API
   server build use esbuild, which fails with *"@esbuild/win32-x64 could not be
   found."* Fix: install just that binary out-of-band and point esbuild at it.
   ```powershell
   npm install --prefix tmp/esbuild-win @esbuild/win32-x64@0.27.3 --no-save
   # then for any esbuild-using command, set:
   $env:ESBUILD_BINARY_PATH = "$PWD\tmp\esbuild-win\node_modules\@esbuild\win32-x64\esbuild.exe"
   ```
   (`tmp/` is gitignored. `0.27.3` is the version pinned in `pnpm-workspace.yaml`.)

2. **Metro needs an uppercase drive letter.** If you launch Expo from a path with
   a lowercase drive (`c:\...`), Metro fails to bundle with *"Failed to get the
   SHA-1 for …"*. Always start it from `C:\Users\...` (capital `C:`).

> A cleaner permanent fix for #1 is to drop the `@esbuild/win32-x64: "-"` line
> from `pnpm-workspace.yaml`'s `overrides` so a normal `pnpm install` fetches it
> natively (safe — Linux/Replit never installs a Windows binary anyway). Ask if
> you want this done.

---

## What you need

- **Node.js 24+** and **pnpm** (`npm i -g pnpm`)
- A **Postgres database** — we'll use a free cloud one (Neon). No local install.
- Two terminals (one for the API, one for the app).

---

## 1. Get a free Postgres database (Neon)

The API server **requires** a `DATABASE_URL` and will refuse to start without
one ([lib/db/src/index.ts](lib/db/src/index.ts)). Neon gives you a free cloud
Postgres in ~2 minutes.

1. Go to **https://neon.tech** and sign up (free tier, no card).
2. Create a new project (any name, e.g. `campus-music`). Pick a region near you.
3. On the project dashboard, open **Connect** / **Connection string** and copy
   the **`psql` / connection string**. It looks like:

   ```
   postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require
   ```

   Use the **pooled** connection string if offered — it's fine here. Keep
   `?sslmode=require` on the end.

That string is your `DATABASE_URL`. Treat it as a secret (don't commit it).

> Alternative: any Postgres works (Supabase, Railway, or a local install). Just
> produce a valid `DATABASE_URL`.

---

## 2. Install dependencies (once)

From the repo root:

```powershell
cd "C:\Users\Kofi Gilbert\Documents\campus-music-app"
pnpm install
```

---

## 3. Create the database tables

Point Drizzle at your Neon database and push the schema (creates all 8 tables).
Run from the repo root:

```powershell
$env:DATABASE_URL = "postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require"
pnpm --filter @workspace/db run push
```

You should see Drizzle create the tables and exit. You only need to do this
once (and again whenever the schema changes).

---

## 4. Start the API server (Terminal 1)

The server listens on `PORT`, connects to `DATABASE_URL`, and **auto-seeds 10
artists + 100 tracks** into the database on first boot.

```powershell
cd "C:\Users\Kofi Gilbert\Documents\campus-music-app"

$env:PORT = "8080"
$env:NODE_ENV = "development"
$env:DATABASE_URL = "postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require"

pnpm --filter @workspace/api-server run dev:local
```

> We use `dev:local` (not `dev`) on Windows. The original `dev` script uses
> bash-only `export` syntax that fails in PowerShell; `dev:local` just runs
> `build` then `start`, which works in any shell.

Leave this running. Verify it's up — in a **third** terminal or your browser:

```powershell
curl http://localhost:8080/api/healthz
# -> {"status":"ok"}
```

If you see `DATABASE_URL must be set`, the env var didn't carry into this
terminal — re-run the `$env:DATABASE_URL = "..."` line above.

### Optional: file uploads / cover art

Track/avatar uploads use Replit's object storage and need
`PUBLIC_OBJECT_SEARCH_PATHS` + `PRIVATE_OBJECT_DIR`. These are **not** required
to run or demo the app — only the upload feature errors without them. Skip for
a UI demo.

---

## 5. Point the app at the local API

The app reads its API origin from `EXPO_PUBLIC_API_URL`
(see [constants/config.ts](artifacts/campus-music-mobile/constants/config.ts)).
Create a `.env` file in the mobile app from the provided example:

```powershell
cd "C:\Users\Kofi Gilbert\Documents\campus-music-app\artifacts\campus-music-mobile"
Copy-Item .env.example .env
```

The default value (`http://localhost:8080`) is correct for the **web browser**
demo. For other targets, edit `.env`:

| Target                  | `EXPO_PUBLIC_API_URL`            |
| ----------------------- | -------------------------------- |
| Web browser / iOS sim   | `http://localhost:8080`          |
| Android emulator        | `http://10.0.2.2:8080`           |
| Physical phone (Expo Go)| `http://<your-PC-LAN-IP>:8080`   |

(Find your LAN IP with `ipconfig` — the IPv4 address, e.g. `192.168.1.50`.)

---

## 6. Start the app (Terminal 2)

### Option A — Web browser (recommended for the demo)

```powershell
cd "C:\Users\Kofi Gilbert\Documents\campus-music-app"
pnpm --filter @workspace/campus-music-mobile run web
```

Expo builds the web bundle and opens it in your browser. You'll land on the
onboarding/welcome flow; register a new account or sign in, and the home feed,
discovery, library, player, etc. will load real data from your local API.

### Option B — Phone with Expo Go

```powershell
cd "C:\Users\Kofi Gilbert\Documents\campus-music-app"
pnpm --filter @workspace/campus-music-mobile run start:local
```

Scan the QR code with **Expo Go**. Make sure `EXPO_PUBLIC_API_URL` in `.env` is
your PC's LAN IP (step 5), and that your phone is on the same Wi-Fi.

---

## Quick reference

```powershell
# One-time on Windows: get the esbuild binary (see Windows prerequisites above)
npm install --prefix tmp/esbuild-win @esbuild/win32-x64@0.27.3 --no-save

# Terminal 1 — API (port 8080, reads artifacts/api-server/.env, seeds on first run)
$env:ESBUILD_BINARY_PATH = "$PWD\tmp\esbuild-win\node_modules\@esbuild\win32-x64\esbuild.exe"
pnpm --filter @workspace/api-server run dev:local

# Terminal 2 — App web demo (must launch from an UPPERCASE C:\ path)
pnpm --filter @workspace/campus-music-mobile run web
```

> `db push` (when the schema changes) similarly needs `$env:ESBUILD_BINARY_PATH`
> set, and creates tables in the `campus_music` schema.

---

## Troubleshooting

- **`DATABASE_URL must be set`** — the env var isn't set in the terminal running
  the API. `$env:` vars only live in the terminal that set them; set it again.
- **App loads but every list is empty / network errors** — the API isn't
  reachable at `EXPO_PUBLIC_API_URL`. Confirm step 4's `healthz` check passes and
  that the URL/port in `.env` matches. After editing `.env`, restart the app
  (stop Expo and re-run), since env vars are read at bundle time.
- **Android emulator can't reach the API** — use `http://10.0.2.2:8080`, not
  `localhost` (inside the emulator `localhost` is the emulator itself).
- **Changed `.env` but nothing changed** — Expo inlines `EXPO_PUBLIC_*` at build
  time. Stop the Expo process and start it again.
- **Port 8080 already in use** — pick another port: set `$env:PORT="8090"` for
  the API and `EXPO_PUBLIC_API_URL=http://localhost:8090` in `.env`.

---

## Notes for the demo

- **Working end-to-end** (real API + DB): auth/onboarding, home & discover feeds,
  trending, most-liked, genres, campuses, library (like/save), the player,
  artist/user profiles, connections, and (artist) track upload.
- **Intentionally mocked** (UI only, no backend): direct messages, listening
  parties, concerts, post likes/comments engagement, and live-stream chat. These
  render with placeholder data — fine to show, but the buttons don't persist.
- The bottom tab bar shows 6 tabs (Home, Discover, Library, Connect, Vibe,
  Profile). `social`, `trending`, and `upload` exist in the codebase but are
  hidden from the tab bar (`href: null`); `upload` is still reachable from Profile.
