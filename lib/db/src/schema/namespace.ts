import { pgSchema } from "drizzle-orm/pg-core";

/**
 * All application tables live in a dedicated Postgres schema rather than
 * `public`, so they never collide with unrelated tables that may already exist
 * in `public` on a shared database. Every table is defined via
 * `campusMusic.table(...)`, which schema-qualifies all generated SQL
 * (`campus_music.tracks`, etc.) at both migration and query time.
 */
export const campusMusic = pgSchema("campus_music");
