# @workspace/db

Drizzle schema + versioned SQL migrations for the `campus_music` Postgres schema.

## Layout

- `src/schema/*.ts` — the Drizzle table definitions (the source of truth).
- `src/migrate.ts` — the migration runner (drizzle-orm migrator).
- `migrations/*.sql` — versioned migrations, applied in journal order.
- `migrations/meta/` — drizzle's journal + snapshots (do not hand-edit).
- `migrations/_historical/` — superseded SQL kept for provenance, **not** applied.
- `drizzle.config.ts` — drizzle-kit config (`out`, schema path, bookkeeping table).

## Workflow

We use **versioned SQL migrations**, not `drizzle-kit push`. `push` mutates the
DB to match the schema with no history and no review step — fine for throwaway
local play, wrong for a shared/production database.

1. Edit `src/schema/*.ts`.
2. Generate a migration from the diff:
   ```bash
   pnpm db:generate            # drizzle-kit generate; writes migrations/NNNN_*.sql
   ```
   Review the generated SQL. Drizzle does **not** emit `CREATE SCHEMA` for the
   custom `campus_music` schema, so the baseline (`0000_init.sql`) carries a
   hand-added `CREATE SCHEMA IF NOT EXISTS "campus_music";` at the top. Add the
   same to any future migration that would run against a brand-new database.
3. Apply pending migrations:
   ```bash
   DATABASE_URL=... pnpm db:migrate
   ```

CI applies migrations to a throwaway Postgres on every PR. The deploy hook
(`scripts/post-merge.sh`) runs `pnpm db:migrate` against the target DB.

> Windows note: `drizzle-kit generate`/`introspect` load the TS config through
> esbuild, whose native binary is stripped from the workspace install. Set
> `ESBUILD_BINARY_PATH` to a local `@esbuild/win32-x64` binary first (see
> `TROUBLESHOOTING.md`). The runner (`db:migrate`) is plain drizzle-orm and is
> unaffected. CI (Linux) needs none of this.

## How drizzle tracks applied migrations

Bookkeeping lives in `drizzle.__drizzle_migrations` (`id, hash, created_at`).
The migrator reads the **latest** row's `created_at` and runs every journal entry
whose `when` timestamp is greater. (It keys off the timestamp, not the hash — the
hash column is informational.)

## Baseline & history

- `migrations/0000_init.sql` — the **from-scratch baseline**: it creates the
  current (already-collapsed) `campus_music` schema. This is what fresh databases
  (CI, new environments) run.
- `migrations/_historical/0001_collapse_artists_into_users.sql` — the original
  hand-authored collapse, applied once to prod during commit `bcf4051`. It is a
  *transformation* of the pre-collapse schema (it reads `FROM artists`), so it
  can never run against a fresh DB and is **not** in the journal. Kept for audit.

## Production bootstrap (one-time, run by a human)

The prod DB already has the baseline schema (it was built with the old `push`
flow, then collapsed by `bcf4051`) but has **no** `drizzle.__drizzle_migrations`
table yet. Before the first `pnpm db:migrate` runs against prod, register the
baseline as already-applied so the migrator does **not** try to recreate existing
tables. Run this once in the Supabase SQL editor:

```sql
-- Register 0000_init as already-applied on the existing prod database.
-- Idempotent: safe to run more than once.
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT
  '3ea4afe199237dad52b09f1ab196bb04db796dddfb9317d0c3ca992f70e0eeb8', -- sha256 of 0000_init.sql
  1782452323321                                                       -- 0000_init journal `when`
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = 1782452323321
);
```

After this, `pnpm db:migrate` against prod skips `0000_init` (its `when` is not
greater than the registered `created_at`) and applies only later migrations
(e.g. `0001_schema_hygiene`).
