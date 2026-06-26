import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import { campusMusic } from "./namespace";
import { users } from "./schema";
import { tracks } from "./tracks";

// AI foundations — SCHEMA ONLY (no inference yet). The transcoder queues ai_jobs
// after transcoding; a future ai-worker (Phase 12) runs the actual ML.

export const trackEmbeddings = campusMusic.table(
  "track_embeddings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    trackId: varchar("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 512 }), // CLAP
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("track_embeddings_track_id_idx").on(t.trackId),
    index("track_embeddings_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const lyricsLines = campusMusic.table(
  "lyrics_lines",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    trackId: varchar("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    lineNumber: integer("line_number").notNull(),
    startMs: integer("start_ms"),
    endMs: integer("end_ms"),
    text: text("text").notNull(),
    language: text("language").notNull().default("en"),
  },
  (t) => [index("lyrics_lines_track_line_idx").on(t.trackId, t.lineNumber)],
);

export const lyricsEmbeddings = campusMusic.table("lyrics_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lyricsLineId: varchar("lyrics_line_id")
    .notNull()
    .references(() => lyricsLines.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 1536 }),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiJobs = campusMusic.table(
  "ai_jobs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    type: text("type").notNull(), // embedding | stems | lyrics_transcription | cover_art_gen | ...
    trackId: varchar("track_id").references(() => tracks.id, { onDelete: "set null" }),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    input: jsonb("input"),
    output: jsonb("output"),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("ai_jobs_status_created_at_idx").on(t.status, t.createdAt)],
);

export const aiGenerations = campusMusic.table(
  "ai_generations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    // Nullable so generation provenance survives user deletion (ON DELETE SET
    // NULL). Decision E.6 said NOT NULL, but that's incompatible with SET NULL.
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    feature: text("feature").notNull(), // lyrics_companion | cover_studio | beat_lab | ...
    model: text("model").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output").notNull(),
    cost: numeric("cost", { precision: 10, scale: 6 }).notNull().default("0"), // USD
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_generations_user_created_idx").on(t.userId, t.createdAt.desc())],
);

export const aiCreditLedger = campusMusic.table(
  "ai_credit_ledger",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // + credit, - debit
    reason: text("reason").notNull(), // monthly_grant | generation | purchase | ...
    generationId: varchar("generation_id").references(() => aiGenerations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_credit_ledger_user_created_idx").on(t.userId, t.createdAt.desc())],
);

export type TrackEmbedding = typeof trackEmbeddings.$inferSelect;
export type AiJob = typeof aiJobs.$inferSelect;
export type AiGeneration = typeof aiGenerations.$inferSelect;
