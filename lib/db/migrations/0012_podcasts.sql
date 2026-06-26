CREATE TABLE "campus_music"."podcasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_key" text,
	"university" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."podcast_episodes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"podcast_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"audio_key" text NOT NULL,
	"duration_seconds" integer,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."podcast_subscriptions" (
	"podcast_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "podcast_subscriptions_podcast_id_user_id_pk" PRIMARY KEY("podcast_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "campus_music"."podcasts" ADD CONSTRAINT "podcasts_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."podcast_episodes" ADD CONSTRAINT "podcast_episodes_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "campus_music"."podcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."podcast_subscriptions" ADD CONSTRAINT "podcast_subscriptions_podcast_id_podcasts_id_fk" FOREIGN KEY ("podcast_id") REFERENCES "campus_music"."podcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."podcast_subscriptions" ADD CONSTRAINT "podcast_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "podcasts_host_idx" ON "campus_music"."podcasts" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "podcasts_university_idx" ON "campus_music"."podcasts" USING btree ("university");--> statement-breakpoint
CREATE INDEX "podcasts_created_idx" ON "campus_music"."podcasts" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "podcast_episodes_podcast_published_idx" ON "campus_music"."podcast_episodes" USING btree ("podcast_id","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "podcast_subscriptions_user_idx" ON "campus_music"."podcast_subscriptions" USING btree ("user_id");