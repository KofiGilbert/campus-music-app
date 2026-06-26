import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // Versioned SQL migrations live here; `drizzle-kit generate` writes new ones
  // and the runner (src/migrate.ts) applies them. See README.md.
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  // App tables live in their own Postgres schema (see schema/namespace.ts).
  // Scope drizzle-kit to it so it never inspects or drops anything in `public`.
  schemaFilter: ["campus_music"],
  // Migration bookkeeping table — drizzle's default (drizzle.__drizzle_migrations).
  // Stated explicitly so the prod bootstrap INSERT (README) targets the right table.
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
