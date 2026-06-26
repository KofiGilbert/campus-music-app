import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Applies pending versioned SQL migrations from ../migrations using drizzle-orm's
// migrator. Bookkeeping lives in drizzle.__drizzle_migrations; drizzle decides
// what to run by comparing each journal entry's `when` against the latest applied
// row's created_at, so an already-applied migration (e.g. the 0000_init baseline
// on prod, registered by the bootstrap INSERT in README.md) is skipped. Run with
// `pnpm --filter @workspace/db run migrate` (DATABASE_URL must be set).

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL must be set to run migrations.");
}

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);

console.log(`Applying migrations from ${migrationsFolder} ...`);
await migrate(db, {
  migrationsFolder,
  migrationsSchema: "drizzle",
  migrationsTable: "__drizzle_migrations",
});
console.log("Migrations up to date.");

await pool.end();
