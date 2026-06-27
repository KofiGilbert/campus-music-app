import * as Sentry from "@sentry/node";

// Sentry must be initialized BEFORE the app + routes are imported, so this module
// is the very first import in index.ts. Inert (no-op) unless SENTRY_DSN is set,
// so dev/CI run untouched; provision the DSN as a Fly secret in production.

const dsn = process.env.SENTRY_DSN;

export const sentryEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  });
}

/** Attach Sentry's Express error handler (after routes, before our handler). No-op when disabled. */
export function attachSentryErrorHandler(app: Parameters<typeof Sentry.setupExpressErrorHandler>[0]): void {
  if (sentryEnabled) Sentry.setupExpressErrorHandler(app);
}
