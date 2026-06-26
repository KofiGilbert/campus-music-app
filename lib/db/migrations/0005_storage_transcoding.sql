CREATE TABLE "campus_music"."upload_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" varchar NOT NULL,
	"source_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campus_music"."tracks" ADD COLUMN "audio_urls" jsonb;--> statement-breakpoint
ALTER TABLE "campus_music"."tracks" ADD COLUMN "cover_urls" jsonb;--> statement-breakpoint
ALTER TABLE "campus_music"."tracks" ADD COLUMN "stem_urls" jsonb;--> statement-breakpoint
ALTER TABLE "campus_music"."tracks" ADD COLUMN "processing_status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "campus_music"."upload_jobs" ADD CONSTRAINT "upload_jobs_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "upload_jobs_status_created_at_idx" ON "campus_music"."upload_jobs" USING btree ("status","created_at");