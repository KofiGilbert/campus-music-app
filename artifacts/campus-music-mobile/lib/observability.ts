import * as Sentry from "@sentry/react-native";

// Crash reporting (Sentry) + product analytics (PostHog). Both are inert unless
// their env keys are set, so dev runs untouched; provision keys via EAS env per
// build profile. PostHog uses its HTTP capture API directly (no native module).

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let initialized = false;
let distinctId = "anonymous";

export function initObservability(): void {
  if (initialized) return;
  initialized = true;
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV ?? "development",
    });
  }
}

export function setAnalyticsUser(id: string | null): void {
  distinctId = id ?? "anonymous";
  if (SENTRY_DSN) Sentry.setUser(id ? { id } : null);
}

export function captureError(error: unknown): void {
  if (SENTRY_DSN) Sentry.captureException(error);
}

/** Fire-and-forget product event to PostHog (no-op without a key). */
export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (!POSTHOG_KEY) return;
  void fetch(`${POSTHOG_HOST}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: POSTHOG_KEY, event, distinct_id: distinctId, properties }),
  }).catch(() => {});
}
