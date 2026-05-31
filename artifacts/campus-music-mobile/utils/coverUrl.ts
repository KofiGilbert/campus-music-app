/**
 * Resize a cover image URL to the requested pixel size.
 *
 * Supported CDN patterns:
 *  - Unsplash: https://images.unsplash.com/...?w=400&h=400&...
 *  - Apple Music CDN: .../600x600bb.jpg  or  .../300x300bb.jpg
 *    (also handles variants with query strings / hash fragments)
 *
 * Falls back to the original URL when the pattern is unrecognised or
 * the URL is malformed.
 */
export function resizeCoverUrl(url: string, size: number): string {
  if (!url) return url;

  const px = Math.round(size);

  // Unsplash – swap out w= and h= params
  if (url.includes("images.unsplash.com")) {
    try {
      const u = new URL(url);
      u.searchParams.set("w", String(px));
      u.searchParams.set("h", String(px));
      u.searchParams.set("fit", "crop");
      u.searchParams.set("auto", "format");
      return u.toString();
    } catch {
      return url;
    }
  }

  // Apple Music CDN – e.g. .../600x600bb.jpg  →  .../80x80bb.jpg
  // Matches the NxNbb.(jpg|png) segment whether or not query/hash follows.
  const appleMatch = url.match(/(\/\d+x\d+)(bb\.(jpg|png))([?#].*)?$/i);
  if (appleMatch) {
    const suffix = appleMatch[4] ?? "";
    return url.replace(
      appleMatch[0],
      `/${px}x${px}${appleMatch[2]}${suffix}`,
    );
  }

  return url;
}
