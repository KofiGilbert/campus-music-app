/**
 * Campus Music — Semantic design tokens
 *
 * Import `useTheme` instead of `useColors` when you need the full token set
 * (spacing, typography, shadows) in addition to colors.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
} as const;

export const typography = {
  // Font sizes
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 22,
  "3xl": 28,
  "4xl": 32,
  "5xl": 40,

  // Font weights (React Native uses string literals)
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,

  // Line heights
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

/** Genre → brand color mapping (used in campuses, social, connect) */
export const genreColors: Record<string, string> = {
  Indie: "#e85d4a",
  Electronic: "#3b82f6",
  Jazz: "#8b5cf6",
  Folk: "#f59e0b",
  "R&B": "#10b981",
  "Lo-Fi": "#6366f1",
  "Hip Hop": "#f97316",
  Ambient: "#0ea5e9",
  Acoustic: "#14b8a6",
  Synth: "#ec4899",
};

/** Well-known Campus Music genre list (mirrors server GENRES) */
export const GENRES = [
  "All", "Indie", "Electronic", "Jazz", "Folk",
  "R&B", "Lo-Fi", "Hip Hop", "Ambient", "Acoustic",
] as const;

export type Genre = typeof GENRES[number];
