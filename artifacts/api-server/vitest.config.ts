import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      // NB: the auth rate-limit budget is intentionally NOT set globally here.
      // A low global limit would hand surprise 429s to any future happy-path
      // test that makes several auth calls (register → login → me, etc.). The
      // limiter test scopes its own tiny budget via vi.stubEnv + a dynamic
      // import of the app (see __tests__/rate-limit.test.ts).
      // The db Pool is created lazily at import, so a placeholder URL lets modules
      // load without a real DB. Integration tests that actually query get a real
      // DATABASE_URL from the CI Postgres service container (passed through here).
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgres://test:test@127.0.0.1:5432/test",
    },
  },
});
