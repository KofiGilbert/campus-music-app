import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      // Trip the auth rate limiter after a handful of requests so the limiter
      // test stays cheap. Well above any single happy-path test's auth calls.
      AUTH_RATE_LIMIT_MAX: "5",
      // The db Pool is created lazily at import, so a placeholder URL lets modules
      // load without a real DB. Integration tests that actually query get a real
      // DATABASE_URL from the CI Postgres service container (passed through here).
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgres://test:test@127.0.0.1:5432/test",
    },
  },
});
