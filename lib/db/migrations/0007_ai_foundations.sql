CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "campus_music"."ai_credit_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"generation_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."ai_generations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb NOT NULL,
	"cost" numeric(10, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."ai_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"track_id" varchar,
	"user_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campus_music"."lyrics_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lyrics_line_id" varchar NOT NULL,
	"embedding" vector(1536),
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."lyrics_lines" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" varchar NOT NULL,
	"line_number" integer NOT NULL,
	"start_ms" integer,
	"end_ms" integer,
	"text" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."track_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" varchar NOT NULL,
	"embedding" vector(512),
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus_music"."users" ADD COLUMN "ai_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campus_music"."users" ADD COLUMN "ai_consent" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "campus_music"."ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_generation_id_ai_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "campus_music"."ai_generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."ai_generations" ADD CONSTRAINT "ai_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."ai_jobs" ADD CONSTRAINT "ai_jobs_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."lyrics_embeddings" ADD CONSTRAINT "lyrics_embeddings_lyrics_line_id_lyrics_lines_id_fk" FOREIGN KEY ("lyrics_line_id") REFERENCES "campus_music"."lyrics_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."lyrics_lines" ADD CONSTRAINT "lyrics_lines_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."track_embeddings" ADD CONSTRAINT "track_embeddings_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_credit_ledger_user_created_idx" ON "campus_music"."ai_credit_ledger" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_generations_user_created_idx" ON "campus_music"."ai_generations" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_jobs_status_created_at_idx" ON "campus_music"."ai_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "lyrics_lines_track_line_idx" ON "campus_music"."lyrics_lines" USING btree ("track_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "track_embeddings_track_id_idx" ON "campus_music"."track_embeddings" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_embeddings_embedding_idx" ON "campus_music"."track_embeddings" USING hnsw ("embedding" vector_cosine_ops);