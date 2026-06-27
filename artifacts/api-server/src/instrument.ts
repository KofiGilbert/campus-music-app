// Sentry is loaded LAZILY and only when SENTRY_DSN is set. @sentry/node pulls in
// the OpenTelemetry runtime; importing it eagerly forces those (externalized)
// packages to resolve at startup even when Sentry is disabled, which breaks the
// bundled server in dev/CI. A dynamic import keeps the disabled path completely
// free of Sentry + OTel. Errors are reported from the central error handler via
// captureException (no Express integration needed), so there's no init race.

const dsn = process.env.SENTRY_DSN;

export const sentryEnabled = !!dsn;

let sentryModule: typeof import("@sentry/node") | null = null;

if (dsn) {
   
  import("@sentry/node").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    });
    sentryModule = Sentry;
  });
}

/** Report an error to Sentry. No-op when disabled. */
export function captureException(error: unknown): void {
  sentryModule?.captureException(error);
}
