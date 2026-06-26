CREATE TABLE "campus_music"."posts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" varchar NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"attached_track_id" varchar,
	"attached_image_url" text,
	"type" text DEFAULT 'original' NOT NULL,
	"original_post_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campus_music"."comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" varchar NOT NULL,
	"author_user_id" varchar NOT NULL,
	"body" text NOT NULL,
	"parent_comment_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campus_music"."post_likes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."comment_likes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."post_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" text DEFAULT 'internal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus_music"."posts" ADD CONSTRAINT "posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."posts" ADD CONSTRAINT "posts_attached_track_id_tracks_id_fk" FOREIGN KEY ("attached_track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."posts" ADD CONSTRAINT "posts_original_post_id_posts_id_fk" FOREIGN KEY ("original_post_id") REFERENCES "campus_music"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."comments" ADD CONSTRAINT "comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "campus_music"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."post_likes" ADD CONSTRAINT "post_likes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "campus_music"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."comment_likes" ADD CONSTRAINT "comment_likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "campus_music"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."post_shares" ADD CONSTRAINT "post_shares_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "campus_music"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."post_shares" ADD CONSTRAINT "post_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_author_created_idx" ON "campus_music"."posts" USING btree ("author_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_created_idx" ON "campus_music"."posts" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "posts_attached_track_idx" ON "campus_music"."posts" USING btree ("attached_track_id");--> statement-breakpoint
CREATE INDEX "posts_original_post_idx" ON "campus_music"."posts" USING btree ("original_post_id");--> statement-breakpoint
CREATE INDEX "comments_target_idx" ON "campus_music"."comments" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "campus_music"."comments" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "campus_music"."comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_likes_post_user_idx" ON "campus_music"."post_likes" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_likes_comment_user_idx" ON "campus_music"."comment_likes" USING btree ("comment_id","user_id");--> statement-breakpoint
CREATE INDEX "post_shares_post_created_idx" ON "campus_music"."post_shares" USING btree ("post_id","created_at" DESC NULLS LAST);