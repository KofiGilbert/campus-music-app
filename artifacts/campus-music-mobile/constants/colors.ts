/**
 * Campus Music design tokens.
 * Brand palette is shared across both color modes — the primary brand coral
 * (#e85d4a) is the same in light and dark. Neutrals shift per mode.
 */

const BRAND = {
  primary: "#e85d4a",       // Campus Music coral/red — brand signature
  primaryDark: "#d44d3a",   // Slightly deeper for dark-mode pressed states
  purple: "#8b5cf6",        // Secondary accent (genre / campus accents)
  blue: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  pink: "#ec4899",
  orange: "#f97316",
  teal: "#14b8a6",
  sky: "#0ea5e9",
  indigo: "#6366f1",
} as const;

const colors = {
  light: {
    text: "#1a1a1a",
    tint: BRAND.primary,

    background: "#f0f0f0",       // Figma off-white background
    foreground: "#1a1a1a",

    card: "#ffffff",
    cardForeground: "#1a1a1a",

    primary: BRAND.primary,
    primaryForeground: "#ffffff",

    secondary: "#e5e5e5",
    secondaryForeground: "#1a1a1a",

    muted: "#ebebeb",
    mutedForeground: "#6b6b6b",

    accent: BRAND.purple,
    accentForeground: "#ffffff",

    destructive: "#e02020",
    destructiveForeground: "#ffffff",

    border: "#d8d8d8",
    input: "#e5e5e5",

    // Music-app surfaces
    surface: "#ffffff",
    surfaceSecondary: "#f5f5f5",
    tabBar: "#ffffff",
    highlight: BRAND.primary,
  },

  dark: {
    text: "#f0f0f0",
    tint: BRAND.primary,

    background: "#0d0d0d",       // Near-black background
    foreground: "#f0f0f0",

    card: "#1a1a1a",
    cardForeground: "#f0f0f0",

    primary: BRAND.primary,       // Same brand coral in dark mode
    primaryForeground: "#ffffff",

    secondary: "#2a2a2a",
    secondaryForeground: "#f0f0f0",

    muted: "#242424",
    mutedForeground: "#8a8a8a",

    accent: BRAND.purple,
    accentForeground: "#ffffff",

    destructive: "#e02020",
    destructiveForeground: "#ffffff",

    border: "#333333",
    input: "#2a2a2a",

    // Music-app surfaces
    surface: "#1a1a1a",
    surfaceSecondary: "#242424",
    tabBar: "#111111",
    highlight: BRAND.primary,
  },

  radius: 12,
  brand: BRAND,
};

export default colors;
