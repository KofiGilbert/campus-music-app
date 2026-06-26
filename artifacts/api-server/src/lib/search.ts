import { and, eq, ne, sql } from "drizzle-orm";
import { db, tracks, users } from "@workspace/db";

// Search behind a provider interface so a later swap to Algolia / OpenSearch is
// one adapter, not a rewrite (DEVIN_ROADMAP §3.15). The Postgres adapter uses
// built-in full-text search (to_tsvector + websearch_to_tsquery, stemmed +
// multi-word) with an ILIKE substring fallback for prefixes. A pg_trgm fuzzy
// layer + a refreshed `search_index` materialized view are the documented
// performance follow-up (not needed at MVP data sizes).

export type SearchFacet = "all" | "tracks" | "artists" | "users" | "universities";

export type TrackRow = typeof tracks.$inferSelect;

export interface ArtistLite {
  id: string;
  name: string;
  genre: string;
  university: string | null;
  coverColor: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface UserLite {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  university: string | null;
  role: string;
}

export interface SearchResults {
  tracks: TrackRow[];
  artists: ArtistLite[];
  users: UserLite[];
  universities: string[];
}

export interface SearchProvider {
  search(q: string, facet: SearchFacet, limit: number): Promise<SearchResults>;
}

function likeArg(q: string): string {
  // Escape LIKE wildcards so a literal % / _ in the query isn't a wildcard.
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

class PostgresFTSProvider implements SearchProvider {
  async search(q: string, facet: SearchFacet, limit: number): Promise<SearchResults> {
    const empty: SearchResults = { tracks: [], artists: [], users: [], universities: [] };
    const query = q.trim();
    if (!query) return empty;

    const like = likeArg(query);
    const tsq = sql`websearch_to_tsquery('english', ${query})`;
    const wantAll = facet === "all";

    const [trackRows, artistRows, userRows, universityRows] = await Promise.all([
      wantAll || facet === "tracks" ? this.searchTracks(query, like, tsq, limit) : Promise.resolve([]),
      wantAll || facet === "artists" ? this.searchArtists(query, like, tsq, limit) : Promise.resolve([]),
      wantAll || facet === "users" ? this.searchUsers(query, like, tsq, limit) : Promise.resolve([]),
      wantAll || facet === "universities" ? this.searchUniversities(like, limit) : Promise.resolve([]),
    ]);

    return { tracks: trackRows, artists: artistRows, users: userRows, universities: universityRows };
  }

  private searchTracks(q: string, like: string, tsq: ReturnType<typeof sql>, limit: number) {
    const doc = sql`to_tsvector('english', coalesce(${tracks.title},'') || ' ' || coalesce(${tracks.artist},'') || ' ' || coalesce(${tracks.genre},'') || ' ' || coalesce(${tracks.university},''))`;
    return db
      .select()
      .from(tracks)
      .where(
        sql`(${doc} @@ ${tsq}) or ${tracks.title} ilike ${like} or ${tracks.artist} ilike ${like} or ${tracks.genre} ilike ${like}`,
      )
      .orderBy(sql`ts_rank(${doc}, ${tsq}) desc, ${tracks.playCount} desc`)
      .limit(limit);
  }

  private searchArtists(q: string, like: string, tsq: ReturnType<typeof sql>, limit: number): Promise<ArtistLite[]> {
    const doc = sql`to_tsvector('english', coalesce(${users.name},'') || ' ' || coalesce(${users.genre},'') || ' ' || coalesce(${users.username},'') || ' ' || coalesce(${users.university},''))`;
    return db
      .select({
        id: users.id,
        name: users.name,
        genre: sql<string>`coalesce(${users.genre}, '')`,
        university: users.university,
        coverColor: sql<string>`coalesce(${users.coverColor}, '')`,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
      })
      .from(users)
      .where(
        and(
          eq(users.role, "artist"),
          sql`(${doc} @@ ${tsq}) or ${users.name} ilike ${like} or ${users.username} ilike ${like} or ${users.genre} ilike ${like}`,
        ),
      )
      .orderBy(sql`ts_rank(${doc}, ${tsq}) desc`)
      .limit(limit);
  }

  private searchUsers(q: string, like: string, tsq: ReturnType<typeof sql>, limit: number): Promise<UserLite[]> {
    const doc = sql`to_tsvector('english', coalesce(${users.name},'') || ' ' || coalesce(${users.username},'') || ' ' || coalesce(${users.university},''))`;
    return db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl,
        university: users.university,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          ne(users.isSystem, true),
          sql`(${doc} @@ ${tsq}) or ${users.name} ilike ${like} or ${users.username} ilike ${like}`,
        ),
      )
      .orderBy(sql`ts_rank(${doc}, ${tsq}) desc`)
      .limit(limit);
  }

  private async searchUniversities(like: string, limit: number): Promise<string[]> {
    const rows = await db
      .selectDistinct({ university: users.university })
      .from(users)
      .where(sql`${users.university} ilike ${like}`)
      .limit(limit);
    return rows.map((r) => r.university).filter((u): u is string => !!u);
  }
}

export const searchProvider: SearchProvider = new PostgresFTSProvider();
