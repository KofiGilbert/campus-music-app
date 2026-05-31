/**
 * Derive a minimal (1×1 component) blurhash string from a solid hex color.
 *
 * A 1×1 blurhash contains only a DC (average) component — it renders as a
 * solid color that exactly matches the track's `coverColor`, giving a
 * visually coherent placeholder while the real image loads.
 *
 * Format: [sizeFlag(1)] [maxAC(1)] [dc(4)]  → 6 characters total
 */

const BASE83 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";

function encode83(n: number, length: number): string {
  let result = "";
  for (let i = 1; i <= length; i++) {
    result += BASE83[Math.floor(n / Math.pow(83, length - i)) % 83];
  }
  return result;
}

function sRGBToLinear(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearTosRGB(value: number): number {
  return Math.max(
    0,
    Math.min(
      255,
      Math.round(
        value <= 0.0031308
          ? value * 12.92 * 255
          : (Math.pow(value, 1 / 2.4) * 1.055 - 0.055) * 255,
      ),
    ),
  );
}

/**
 * Convert a hex color string (#rrggbb) to a valid blurhash placeholder.
 * Returns the same static fallback when the input is invalid.
 */
export function colorToBlurhash(hex: string): string {
  const FALLBACK = "L6PZfSjE.AyE_3t7t7R**0o#DgR4";

  if (!hex || hex.length < 7 || !hex.startsWith("#")) return FALLBACK;

  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return FALLBACK;

    const lr = sRGBToLinear(r);
    const lg = sRGBToLinear(g);
    const lb = sRGBToLinear(b);

    const dcValue =
      (linearTosRGB(lr) << 16) | (linearTosRGB(lg) << 8) | linearTosRGB(lb);

    // 1×1 component: sizeFlag=0, maxAC=0, then 4-char DC
    return encode83(0, 1) + encode83(0, 1) + encode83(dcValue, 4);
  } catch {
    return FALLBACK;
  }
}
