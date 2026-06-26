ALTER TABLE "campus_music"."tracks" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "campus_music"."tracks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "campus_music"."user_likes" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "campus_music"."user_connections" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "campus_music"."user_playback" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "campus_music"."tracks" ADD CONSTRAINT "tracks_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."user_likes" ADD CONSTRAINT "user_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."user_likes" ADD CONSTRAINT "user_likes_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."user_connections" ADD CONSTRAINT "user_connections_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."user_connections" ADD CONSTRAINT "user_connections_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."artist_follows" ADD CONSTRAINT "artist_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."artist_follows" ADD CONSTRAINT "artist_follows_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."user_playback" ADD CONSTRAINT "user_playback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "campus_music"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus_music"."user_playback" ADD CONSTRAINT "user_playback_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "campus_music"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "campus_music"."users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "tracks_artist_id_idx" ON "campus_music"."tracks" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "tracks_created_at_idx" ON "campus_music"."tracks" USING btree ("created_at" DESC NULLS LAST);