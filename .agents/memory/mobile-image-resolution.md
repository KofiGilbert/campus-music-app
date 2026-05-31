---
name: Mobile cover/image resolution
description: How TrackCover sizes CDN image requests and why images looked pixelated.
---

Images in campus-music-mobile looked pixelated because CDN image requests were under-resolved for high-DPI screens.

**Conventions / rules:**
- `TrackCover`'s `thumbSize` prop (or its `size * 2` default) is a **2x baseline**. The component multiplies it by the device pixel ratio (`PixelRatio.get()`, capped at 3) so covers stay sharp on DPR-3 phones. When adding a caller, pass `thumbSize` as the 2x value, not the final pixel count.
- `resizeCoverUrl(url, px)` rewrites Unsplash (`w`/`h` params) and Apple Music (`/NxNbb.jpg`) URLs to the requested square size. It only handles those two CDNs; anything else returns the original URL unchanged.
- Avatar source URLs hardcoded in mock data should request at least ~160px (`w=160`), not 80px — 80px is below 2x for ~40px avatars.

**Why:** the original requests (e.g. hero capped at 600px, avatars at w=80, fixed 2x thumbs) were soft on Retina/DPR-3 displays.
