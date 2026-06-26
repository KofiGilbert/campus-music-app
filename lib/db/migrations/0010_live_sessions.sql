CREATE TABLE "campus_music"."live_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_user_id" varchar NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'live' NOT NULL,
	"transport" text DEFAULT 'livekit' NOT NULL,
	"room_name" text NOT NULL,
	"listener_count" integer DEFAULT 0 NOT NULL,
	"peak_listener_count" integer DEFAULT 0 NOT NULL,
	"recording_track_id" varchar,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."live_chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus_music"."live_sessions" ADD CONSTRAINT "live_sessions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."live_sessions" ADD CONSTRAINT "live_sessions_recording_track_id_tracks_id_fk" FOREIGN KEY ("recording_track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."live_chat_messages" ADD CONSTRAINT "live_chat_messages_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "campus_music"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."live_chat_messages" ADD CONSTRAINT "live_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_sessions_status_started_idx" ON "campus_music"."live_sessions" USING btree ("status","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "live_sessions_host_idx" ON "campus_music"."live_sessions" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "live_chat_session_created_idx" ON "campus_music"."live_chat_messages" USING btree ("session_id","created_at" DESC NULLS LAST);