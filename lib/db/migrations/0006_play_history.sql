CREATE TABLE "campus_music"."play_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"track_id" varchar NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seconds_listened" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"context" text
);
--> statement-breakpoint
CREATE TABLE "campus_music"."track_skips" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"track_id" varchar NOT NULL,
	"skipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seconds_before_skip" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus_music"."play_history" ADD CONSTRAINT "play_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."play_history" ADD CONSTRAINT "play_history_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."track_skips" ADD CONSTRAINT "track_skips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."track_skips" ADD CONSTRAINT "track_skips_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "play_history_user_played_idx" ON "campus_music"."play_history" USING btree ("user_id","played_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "play_history_track_played_idx" ON "campus_music"."play_history" USING btree ("track_id","played_at");--> statement-breakpoint
CREATE INDEX "play_history_played_idx" ON "campus_music"."play_history" USING btree ("played_at");--> statement-breakpoint
CREATE INDEX "track_skips_user_track_idx" ON "campus_music"."track_skips" USING btree ("user_id","track_id");