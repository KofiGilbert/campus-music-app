import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  // App tables live in their own Postgres schema (see schema/namespace.ts).
  // Scope drizzle-kit to it so push never inspects or drops anything in `public`.
  schemaFilter: ["campus_music"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
