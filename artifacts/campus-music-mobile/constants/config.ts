import { Platform } from "react-native";

/**
 * Resolve the API base URL that the generated API client should prepend to
 * relative request paths (e.g. `/api/tracks`).
 *
 * Resolution priority:
 *
 *   1. `EXPO_PUBLIC_API_URL` — an explicit, full origin (e.g.
 *      `http://localhost:8080`). Honoured on **every** platform (web + native).
 *      This is the knob to use for LOCAL development without Replit's proxy.
 *      - Web / iOS simulator: `http://localhost:8080`
 *      - Android emulator:    `http://10.0.2.2:8080`  (emulator alias for host)
 *      - Physical device:     `http://<your-LAN-IP>:8080`
 *
 *   2. `EXPO_PUBLIC_DOMAIN` (native only) — the Replit dev/prod domain. Kept for
 *      backwards-compatibility with the Replit preview, where it is injected
 *      automatically and the API is reachable at `https://<domain>/api/...`.
 *
 *   3. `null` — no base URL. Relative paths resolve against the same origin the
 *      bundle is served from. This is correct for web running behind Replit's
 *      reverse proxy (where `/api` is same-origin).
 *
 * Returns `null` when no base URL should be applied (the client then uses
 * same-origin relative paths).
 */
export function resolveApiBaseUrl(): string | null {
  const base = resolveRawBaseUrl();
  if (!base) return null;

  // The Android emulator cannot reach the host machine via `localhost` /
  // `127.0.0.1` — those resolve to the emulator itself. `10.0.2.2` is the
  // emulator's special alias for the host loopback, so rewrite local hosts to
  // it on Android. This keeps a single `EXPO_PUBLIC_API_URL=http://localhost:8080`
  // working across web, iOS simulator, and the Android emulator.
  if (Platform.OS === "android") {
    return base.replace(
      /^(https?:\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/i,
      (_m, scheme, _host, tail) => `${scheme}10.0.2.2${tail}`,
    );
  }

  return base;
}

function resolveRawBaseUrl(): string | null {
  // 1. Explicit override — works everywhere, takes precedence.
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  // 2. Replit native preview: derive https origin from the injected domain.
  if (Platform.OS !== "web") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (domain) {
      return `https://${domain}`;
    }
  }

  // 3. Same-origin (web behind a proxy, or unconfigured).
  return null;
}
