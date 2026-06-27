CREATE TABLE "campus_music"."shows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'special' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"host_user_id" varchar,
	"featured_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"stream_id" text,
	"stream_key" text,
	"rtmps_url" text,
	"playback_url" text,
	"vod_url" text,
	"thumbnail_url" text,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"peak_viewer_count" integer DEFAULT 0 NOT NULL,
	"total_views" integer DEFAULT 0 NOT NULL,
	"chat_enabled" boolean DEFAULT true NOT NULL,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurring_schedule" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."show_chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'message' NOT NULL,
	"is_moderated" boolean DEFAULT false NOT NULL,
	"moderated_by_user_id" varchar,
	"moderated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."show_reminders" (
	"show_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "show_reminders_show_id_user_id_pk" PRIMARY KEY("show_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "campus_music"."shows" ADD CONSTRAINT "shows_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "campus_music"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."show_chat_messages" ADD CONSTRAINT "show_chat_messages_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "campus_music"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."show_chat_messages" ADD CONSTRAINT "show_chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."show_chat_messages" ADD CONSTRAINT "show_chat_messages_moderated_by_user_id_users_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "campus_music"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."show_reminders" ADD CONSTRAINT "show_reminders_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "campus_music"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."show_reminders" ADD CONSTRAINT "show_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shows_status_scheduled_idx" ON "campus_music"."shows" USING btree ("status","scheduled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "shows_status_started_idx" ON "campus_music"."shows" USING btree ("status","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "show_chat_show_created_idx" ON "campus_music"."show_chat_messages" USING btree ("show_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "show_reminders_user_idx" ON "campus_music"."show_reminders" USING btree ("user_id");