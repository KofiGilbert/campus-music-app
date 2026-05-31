---
name: Mobile icons — use SVG, not icon fonts (Expo Go env)
description: Why the campus-music mobile app renders icons via an SVG wrapper instead of @expo/vector-icons, and the constraint that drove it.
---

Decision: the Expo mobile app renders all icons through an SVG wrapper
(`components/icons.tsx`, backed by `lucide-react-native` over `react-native-svg`)
that exposes drop-in `Ionicons` / `Feather` components (`{name,size,color,style}`
plus a `glyphMap` so `keyof typeof Ionicons.glyphMap` typing keeps compiling).
Do NOT reintroduce `@expo/vector-icons` or any TTF icon-font loading.

**Why:** `@expo/vector-icons` glyphs rendered as tofu / "X" boxes on Android while
fine on iOS/web. This Replit-managed Expo environment runs **Expo Go only** —
there is no dev-client / `expo prebuild` / native Android build path, so config
plugins (e.g. the `expo-font` TTF embed in app.json) are inert at runtime and the
Android font family never resolved. SVG icons carry their own path data and render
identically on web/iOS/Android with zero font dependency, sidestepping the issue
entirely.

**How to apply:**
- Add new icons by mapping the name to a Lucide component in `IONICON_MAP` /
  `FEATHER_MAP`. Unmapped names fall back to `Circle` (with a `__DEV__` warn).
- Solid vs outline (e.g. liked heart, saved bookmark, play/pause) is controlled by
  the `FILLED` set, which passes `fill={color}`. Tab active states differentiate by
  color only — do not force-fill `compass`/`radio`/`person-circle`, whose Lucide
  glyphs fill into unreadable blobs.

Validation note: with SVG, the web preview IS a valid check (it's the same SVG the
native side renders) — unlike the old font approach, where web auto-injected
`@font-face` and always looked fine regardless of native state.
