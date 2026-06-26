CREATE TABLE "campus_music"."flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" varchar NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by_user_id" varchar,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus_music"."users" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campus_music"."users" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campus_music"."flags" ADD CONSTRAINT "flags_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."flags" ADD CONSTRAINT "flags_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "campus_music"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flags_status_created_idx" ON "campus_music"."flags" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "flags_reporter_idx" ON "campus_music"."flags" USING btree ("reporter_user_id");