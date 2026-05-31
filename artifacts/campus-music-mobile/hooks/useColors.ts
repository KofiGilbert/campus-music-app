import colors from "@/constants/colors";

/**
 * Returns the design tokens for the app palette.
 *
 * Campus Music is a dark-themed brand, so this always returns the dark
 * palette regardless of the device/browser appearance setting. (The
 * default scaffold switched on `useColorScheme()`, which made the web
 * preview render the light palette when the browser was in light mode.)
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
