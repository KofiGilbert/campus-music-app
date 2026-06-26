// Parse @mentions and #hashtags from post/comment bodies. Phase 3 stores the raw
// text and lets the client linkify; the server-side extraction is shared by post
// + comment creation (and is the foundation for Phase 6 mention notifications).

const MENTION_RE = /(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{1,30})/g;
const HASHTAG_RE = /(?:^|[^a-zA-Z0-9_])#([a-zA-Z0-9_]{1,50})/g;

/** Extract unique, lowercased @usernames from text. */
export function extractMentions(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) out.add(m[1].toLowerCase());
  return [...out];
}

/** Extract unique, lowercased #hashtags (without the leading #) from text. */
export function extractHashtags(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(HASHTAG_RE)) out.add(m[1].toLowerCase());
  return [...out];
}
