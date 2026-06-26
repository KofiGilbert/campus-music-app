-- 0001_collapse_artists_into_users.sql
--
-- HISTORICAL — NOT part of the drizzle migration journal.
--
-- Collapses campus_music.artists into campus_music.users (DEVIN_ROADMAP.md §3.5).
-- Hand-authored, not drizzle-generated. Applied once to the live DB during the
-- atomic collapse commit (bcf4051) via a transactional psql run.
--
-- Why it lives here and not in the journal: this is a *transformation* of the
-- pre-collapse schema (it ALTERs users, copies rows FROM artists, then DROPs
-- artists). It cannot run against a fresh database — there is no artists table
-- to read. The drizzle journal's from-scratch baseline is 0000_init.sql, which
-- creates the already-collapsed schema directly. New environments (CI, future
-- deploys) get the collapsed shape from 0000_init; they never replay this file.
-- Kept for provenance / audit of how prod reached its current shape.
--
-- See lib/db/README.md for the migration workflow and the prod bootstrap step.

BEGIN;

-- 1. Add the artist profile fields + system/admin/timestamp columns to users.
ALTER TABLE campus_music.users
  ADD COLUMN IF NOT EXISTS bio         text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS genre       text,
  ADD COLUMN IF NOT EXISTS cover_color text,
  ADD COLUMN IF NOT EXISTS is_system   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_admin    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- 2. Backfill the seeded artists a1..a10 as system "artist" users, keeping ids.
--    artists has no username/email/password/country columns, so synthesize them.
INSERT INTO campus_music.users
  (id, username, password, email, name, role, university, country,
   avatar_url, bio, genre, cover_color, is_system)
SELECT
  a.id,
  a.id,                                              -- username = 'a1'..'a10'
  '!system-no-login',                                -- sentinel; login is guarded
  'seed+' || a.id || '@campus-music.local',          -- non-routable .local domain
  a.name,
  'artist',
  a.university,
  '',                                                -- country (NOT NULL default '')
  a.avatar_url,
  a.bio,
  a.genre,
  a.cover_color,
  true
FROM campus_music.artists a
ON CONFLICT (id) DO NOTHING;

-- 3. Drop the fake seeded follower rows BEFORE the schema-hygiene FK is added on
--    artist_follows.user_id (those user ids have no users row).
DELETE FROM campus_music.artist_follows WHERE user_id LIKE 'seed_f_%';

-- 4. Drop the now-redundant artists table (no FKs reference it today).
DROP TABLE campus_music.artists;

COMMIT;
