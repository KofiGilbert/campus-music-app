---
name: Mobile splash / auth init hang
description: Why the Expo app could hang on the splash screen and how navigation/auth init must be time-boxed
---

# Mobile splash hang on slow network

The Expo app's splash route (`app/index.tsx`) navigates away only after `useAuth().isLoading`
flips false. `AuthContext` sets `isLoading=false` in a `finally`, but it `await`s `getMe()` —
and `lib/api-client-react/src/custom-fetch.ts` has **no fetch timeout**. On a slow/proxied
network a hung request meant `finally` never ran, `isLoading` stayed true, and the splash hung
forever (appeared as a stuck/blank splash).

**Rule:** any auth/bootstrap call that gates first-paint navigation must be time-boxed, and the
splash must have an independent hard-fallback navigation timer — never rely solely on an async
state flip to leave the splash.

**How applied here:** `AuthContext` races `getMe()` against an 8s timeout; `app/index.tsx` has a
guarded `navigateAway()` (ref-guarded against double-nav) called by both the normal post-auth 2s
timer and a 10s hard-fallback timer. Routing uses an `isAuthenticatedRef` to avoid stale closures.

**Edge case (accepted):** token present but `getMe` times out AND no cached user → routes to
onboarding. Not reachable in normal flow because `signIn` always persists user+token together,
so the catch branch (`if (storedUser) setUser(...)`) keeps slow-network users authenticated.

## Two separate splashes (don't confuse them)

A reported "stuck on white splash" was actually the **Expo loading splash**
(`app.json` → `expo.splash.backgroundColor`, was `#e9e9e9` light gray), shown while
the JS bundle compiles — NOT the React splash (`app/index.tsx`, dark `#0d0d0d`, large
logo). In dev the web bundle takes ~12s, so the Expo splash is visible a long time.
Keep the Expo splash backgroundColor matching the React splash (`#0d0d0d`) so startup
is seamless. The Expo splash's small contained icon vs the React splash's large logo
is the tell for which one you're looking at.
