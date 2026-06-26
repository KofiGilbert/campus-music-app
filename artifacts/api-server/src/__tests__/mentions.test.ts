import { describe, it, expect } from "vitest";
import { extractMentions, extractHashtags } from "../lib/mentions";

describe("mentions/hashtags extraction", () => {
  it("extracts unique lowercased mentions, ignoring emails", () => {
    expect(extractMentions("hi @Alice and @bob, also @Alice")).toEqual(["alice", "bob"]);
    expect(extractMentions("email me@example.com not a mention")).toEqual([]);
    expect(extractMentions("no mentions here")).toEqual([]);
  });

  it("extracts unique lowercased hashtags", () => {
    expect(extractHashtags("love #Campus and #music #campus")).toEqual(["campus", "music"]);
    // A # preceded by an alphanumeric (c#sharp) is not a tag start.
    expect(extractHashtags("c#sharp is not a tag but #valid is")).toEqual(["valid"]);
  });
});
