---
name: RN Web list scrolling
description: Why FlatList/ScrollView won't scroll on React Native Web in the Expo mobile app, and the fix.
---

On React Native **Web**, a `FlatList`/`ScrollView` only scrolls internally when it has an explicitly bounded height. A scroller with only `contentContainerStyle` (no `style`) grows to its full content height, so the page shows everything and nothing scrolls.

**Rule:** every primary vertical scroller that is the full-screen content of a tab/screen must have `style={{ flex: 1 }}`, and its parent container must already be `flex: 1` (so the flex chain bounds the height).

**Why:** native RN tolerates the missing flex (the parent bounds it implicitly); RN Web does not. This surfaced as "can't scroll" on the Expo web preview across the campus-music-mobile tab screens.

**How to apply:**
- Add `style={{ flex: 1 }}` to the main vertical `FlatList`/`ScrollView`, including each branch of a conditionally-rendered list (e.g. tab switches).
- Do NOT add `flex: 1` to horizontal carousels (`horizontal` lists) — it breaks their layout.
- Conditionally-rendered lists with sibling headers/sections above them are fine: the header keeps intrinsic height, the `flex: 1` list takes the remaining space.
