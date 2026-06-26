CREATE SCHEMA IF NOT EXISTS "campus_music";
--> statement-breakpoint
CREATE TABLE "campus_music"."users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'listener' NOT NULL,
	"university" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"bio" text DEFAULT '' NOT NULL,
	"genre" text,
	"cover_color" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "campus_music"."tracks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"artist_id" text NOT NULL,
	"genre" text NOT NULL,
	"duration" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"cover_color" text NOT NULL,
	"audio_url" text,
	"cover_url" text,
	"play_count" integer DEFAULT 0 NOT NULL,
	"university" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_music"."user_library" (
	"user_id" text NOT NULL,
	"track_id" text NOT NULL,
	CONSTRAINT "user_library_user_id_track_id_pk" PRIMARY KEY("user_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "campus_music"."user_likes" (
	"user_id" text NOT NULL,
	"track_id" text NOT NULL,
	CONSTRAINT "user_likes_user_id_track_id_pk" PRIMARY KEY("user_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "campus_music"."user_connections" (
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_connections_from_user_id_to_user_id_pk" PRIMARY KEY("from_user_id","to_user_id")
);
--> statement-breakpoint
CREATE TABLE "campus_music"."artist_follows" (
	"user_id" text NOT NULL,
	"artist_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artist_follows_user_id_artist_id_pk" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "campus_music"."user_playback" (
	"user_id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"position" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
