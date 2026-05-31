# Troubleshooting & Lessons Learned (Windows local dev)

Hard-won notes from getting this Replit-built monorepo running locally on Windows.
Companion to [RUNNING.md](RUNNING.md). Format: **Symptom → Cause → Fix**.

The single most important meta-lesson is at the top because it cost the most time:

> **When a fix "doesn't take," verify the COMPILED/SERVED artifact, not just the
> source.** Source being correct proves nothing about what the device runs.
> Grep the actual bundle Metro serves; check how many bundlers are running and
> which one the device is attached to.

---

## 1. Crash persists after a confirmed source fix — "stale bundle"

**Symptom:** App crashes with an error quoting code that no longer exists in
source, e.g. `(apiTracksRaw ?? []).map is not a function`, even though
[PlayerContext.tsx:347](artifacts/campus-music-mobile/context/PlayerContext.tsx#L347)
now uses `Array.isArray(...)`.

**Cause (two layers):**
1. **A second Metro was running.** Two `expo start` instances were live — one on
   the default port **8081** and one on **8082**. The device connects to **8081**
   by default; we'd been verifying the wrong one.
2. **Device-side stale JS.** The dev client was running a bundle it had loaded
   *before* the fix and never re-fetched. A plain reload can serve the device's
   cached bundle.

**How to diagnose (do this, don't guess):**
```bash
# How many bundlers are running, and on what ports?
netstat -ano -p tcp | grep LISTENING | grep -E ":(8081|8082)"

# Pull the manifest to get the real bundle URL (SDK 54 uses a virtual entry,
# so /index.bundle 404s):
curl -s -H "expo-platform: android" -H "Accept: application/expo+json" \
  "http://127.0.0.1:8081/" | node -e '...print launchAsset.url...'

# Grep the ACTUAL compiled bundle for old vs new code (dev bundles aren't minified):
curl -s "<launchAsset.url>" > bundle.js
grep -c 'apiTracksRaw ?? \[\]'      bundle.js   # expect 0
grep -c 'Array.isArray(apiTracksRaw)' bundle.js   # expect 1
```

**Fix:**
1. Kill **all** Metro instances (`taskkill //PID <pid> //F`).
2. Start **one** Metro with cache clear: `expo start --port 8081 --clear`
   (log says *"Bundler cache is empty, rebuilding"*).
3. Re-grep the served bundle to confirm the fix is in it.
4. On the device: **fully close the app and reopen it** (cold launch forces a
   fresh fetch). If still stale: clear the dev client's data / reinstall.

---

## 2. Restarting Metro under a running app freezes the app

**Symptom:** App screen freezes / stuck on "Downloading JavaScript bundle…".

**Cause:** Metro was killed/restarted (especially with `--clear`, which rebuilds
from empty and is slow) **while the app was attached** — and a reload fired
during that window. The dev client had no bundler to fetch from.

**Fix:** It's the *app* that's stuck, not the emulator (verify:
`adb shell getprop sys.boot_completed` → `1`). Close the app from Recents and
reopen, or cold-boot the emulator (Android Studio → Device Manager → *Cold Boot
Now*, or `adb reboot`). **Lesson:** start/clear Metro *before* launching the app,
not underneath it.

---

## 3. esbuild has no Windows binary

**Symptom:** `db push` and the API server build fail with
*"The package '@esbuild/win32-x64' could not be found."*

**Cause:** `pnpm-workspace.yaml` deliberately strips every non-Linux native
binary (Replit is Linux-only) — including esbuild's Windows binary. drizzle-kit
and the API build both use esbuild.

**Fix:** install just that binary out-of-band and point esbuild at it:
```powershell
npm install --prefix tmp/esbuild-win @esbuild/win32-x64@0.27.3 --no-save
$env:ESBUILD_BINARY_PATH = "$PWD\tmp\esbuild-win\node_modules\@esbuild\win32-x64\esbuild.exe"
```
(`0.27.3` is the version pinned in `pnpm-workspace.yaml`. `tmp/` is gitignored.)
A cleaner permanent fix: drop the `@esbuild/win32-x64: "-"` override line so a
normal `pnpm install` fetches it (safe — Linux never installs a Windows binary).

---

## 4. Metro "Failed to get the SHA-1 for …" (uppercase drive letter)

**Symptom:** Web/Android bundling fails with *"Failed to get the SHA-1 for
C:\…\some-file.js"*.

**Cause:** Launching from a path with a **lowercase** drive (`c:\…`). Metro's
file-map crawler normalizes to uppercase `C:\`, and the case mismatch breaks the
SHA-1 lookup.

**Fix:** Always start Expo/Metro from an **uppercase** `C:\…` path.

---

## 5. `babel-preset-expo` not found under pnpm

**Symptom:** Bundling fails with *"Cannot find module 'babel-preset-expo'."*

**Cause:** It was a transitive dep of `expo`, not a **direct** dependency of the
mobile app, so pnpm's strict layout didn't link it where Babel (which resolves
relative to `babel.config.js`) could find it.

**Fix:** declared it directly in
[artifacts/campus-music-mobile/package.json](artifacts/campus-music-mobile/package.json)
(`"babel-preset-expo": "54.0.11"`) and ran `pnpm install`. **Lesson:** under pnpm,
anything referenced by config-file *name* (babel presets/plugins) usually needs
to be a direct dependency.

---

## 6. Android emulator can't reach the API on `localhost`

**Symptom:** Feed/lists empty on Android emulator; web works fine.

**Cause:** Inside the Android emulator, `localhost` is the emulator itself, not
the host machine.

**Fix:** [constants/config.ts](artifacts/campus-music-mobile/constants/config.ts)
resolves the base URL then rewrites `localhost`/`127.0.0.1` → **`10.0.2.2`** when
`Platform.OS === "android"`. So one `.env` works everywhere.

> **Real phone:** `10.0.2.2` is emulator-only. A physical phone needs the PC's
> **LAN IP** (e.g. `http://192.168.1.50:8080`) in `EXPO_PUBLIC_API_URL`, and the
> phone must be on the same Wi-Fi. (Without it the app won't crash — it falls
> back to `FALLBACK_TRACKS` — it just won't show real data.)

---

## 7. Supabase connection gotchas

- **Wrong host shape:** the legacy direct host `db.<ref>.supabase.co` may not
  resolve (`ENOTFOUND`). Use the **pooler** URI from *Connect*:
  `postgres.<ref>@aws-1-<region>.pooler.supabase.com:6543`.
- **SSL required, but the code sets none:** the pg Pool in
  [lib/db/src/index.ts](lib/db/src/index.ts) passes no `ssl` option, so the URL
  must carry **`?sslmode=no-verify`** (equivalent to `rejectUnauthorized: false`,
  which is what connected successfully).
- **`@` in the password** must be URL-encoded as `%40` in the URI — but a wrong
  password fails the same way regardless, so test credentials as discrete fields
  to disambiguate. Prefer letters/digits-only passwords.
- **Always test the string before building on it** (a tiny `pg.Client` +
  `select 1` script saved hours of chasing the wrong layer).

---

## 8. The DB was not empty — schema isolation

**Symptom:** `db push` dropped into interactive "created or renamed?" prompts.

**Cause:** the target DB already had **40 tables** from a different app build in
`public`; our 8-table schema would have tried to drop/alter them (destructive).

**Fix:** put our tables in a dedicated **`campus_music`** Postgres schema
([schema/namespace.ts](lib/db/src/schema/namespace.ts) via `pgSchema`) and scope
drizzle with `schemaFilter: ["campus_music"]`
([drizzle.config.ts](lib/db/drizzle.config.ts)) so push can never touch `public`.
Runtime queries are auto-qualified, so no app code changed.

**drizzle-kit on Windows:** its config glob mishandles backslash paths
(*"No schema files found"*). Use a **forward-slash absolute** schema path. Also
note `drizzle-kit push` against a pre-existing schema may emit a harmless
trailing `DROP SCHEMA` error *after* creating the tables — verify table state
directly rather than trusting the exit message.

---

## 9. pnpm `preinstall` guard fires on `pnpm run <script>`

**Symptom:** Running a script via `pnpm --filter … run <x>` fails with
*"Use pnpm instead"* from the root `preinstall`.

**Cause:** pnpm's pre-run "deps status check" auto-spawns an install whose
`npm_config_user_agent` isn't `pnpm/*` in some shells, tripping the guard.

**Fix:** run the underlying binary directly with `node` (that's how `db push`,
the API build, and Expo were launched here), or run `pnpm install` directly
(which *does* carry the right user agent). A direct `pnpm install` works fine.

---

## 10. adb is unreliable on this emulator image

`adb devices`, `getprop`, and `echo` work, but `input keyevent`, `pm list
packages`, `dumpsys`, and `logcat` capture frequently hang or return nothing.
Don't depend on scripted adb to drive/observe the app — verify server-side
(Metro bundle contents, API endpoints) and reload on the device by hand. If adb
wedges entirely: `adb kill-server && adb start-server` (re-authorize the device).

---

## Quick diagnostic cheat-sheet

```bash
# Which servers are up?
netstat -ano -p tcp | grep LISTENING | grep -E ":(8080|8081|8082)"

# API alive + data seeded?
curl -s localhost:8080/api/healthz                       # {"status":"ok"}
curl -s localhost:8080/api/artists | node -e '…length'   # 10
curl -s "localhost:8080/api/tracks?limit=200" | …        # 100

# Is the SERVED bundle actually fixed? (grep compiled output, not source)
curl -s "<launchAsset.url from manifest>" | grep -c '<old pattern>'   # expect 0

# Emulator alive (vs app frozen)?
adb shell getprop sys.boot_completed                     # 1
```
