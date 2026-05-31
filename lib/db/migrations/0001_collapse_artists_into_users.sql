-- 0001_collapse_artists_into_users.sql
--
-- Collapses the separate `campus_music.artists` table into `campus_music.users`
-- (DEVIN_ROADMAP.md §3.5; approach approved by Devin).
--
-- ⚠️ DO NOT RUN against any database until Devin reviews this file.
--    Not applied via `drizzle-kit push`. Will run through `pnpm db:migrate`
--    once the migrations runner lands (see lib/db/README.md, separate commit).
--
-- Decisions baked in (Devin, Phase 0):
--   * Keep the seeded ids a1..a10 as the users.id (ON CONFLICT (id) DO NOTHING).
--   * System rows: email seed+a{n}@campus-music.local (NOT the real .app domain),
--     username = the id, password = sentinel '!system-no-login'. A runtime guard
--     in /auth/login (separate commit) rejects is_system accounts with 403.
--   * Drop the fake seed_f_* follower rows BEFORE the FK step (option a) so the
--     inflated follower counts do not survive into the real schema.
--   * Foreign keys + indexes (tracks.artist_id -> users.id, artist_follows.* ->
--     users.id, etc.) are added by the schema-hygiene migration, which MUST run
--     AFTER this one (a1..a10 must exist in users and seed_f_* must be gone first).

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

-- ============================================================================
-- DOWN (best-effort; destructive collapse is not perfectly reversible).
-- Provided per CLAUDE_ROADMAP §4. The formal up/down split will be finalized
-- when the migrations runner convention lands. Recreating artists from the
-- system users recovers structure but NOT the dropped seed_f_* follower rows.
-- ----------------------------------------------------------------------------
-- BEGIN;
-- CREATE TABLE campus_music.artists (
--   id          varchar PRIMARY KEY,
--   name        text NOT NULL,
--   genre       text NOT NULL,
--   university  text NOT NULL DEFAULT '',
--   cover_color text NOT NULL,
--   avatar_url  text,
--   bio         text NOT NULL DEFAULT ''
-- );
-- INSERT INTO campus_music.artists (id, name, genre, university, cover_color, avatar_url, bio)
-- SELECT id, name, COALESCE(genre, ''), university, COALESCE(cover_color, ''), avatar_url, bio
-- FROM campus_music.users WHERE is_system = true AND role = 'artist';
-- ALTER TABLE campus_music.users
--   DROP COLUMN bio, DROP COLUMN genre, DROP COLUMN cover_color,
--   DROP COLUMN is_system, DROP COLUMN is_admin,
--   DROP COLUMN created_at, DROP COLUMN updated_at;
-- COMMIT;
-- ============================================================================
