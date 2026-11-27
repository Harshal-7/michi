CREATE TYPE "public"."kana_game_mode" AS ENUM('read', 'find');--> statement-breakpoint
CREATE TABLE "kana_game_answers" (
	"game_id" uuid NOT NULL,
	"item_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"right" boolean NOT NULL,
	"ms" integer NOT NULL,
	"given" text DEFAULT '' NOT NULL,
	"tries" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "kana_game_answers_game_id_item_id_pk" PRIMARY KEY("game_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "kana_games" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mode" "kana_game_mode" NOT NULL,
	"weakest" boolean DEFAULT false NOT NULL,
	"scripts" text[] NOT NULL,
	"groups" text[] NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"study_date" date NOT NULL,
	"cards" smallint NOT NULL,
	"first_try_right" smallint NOT NULL,
	"score" smallint NOT NULL,
	"best_streak" smallint NOT NULL,
	"mean_ms" integer,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kana_games_score" CHECK ("kana_games"."score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "kana_game_answers" ADD CONSTRAINT "kana_game_answers_game_id_kana_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."kana_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kana_game_answers" ADD CONSTRAINT "kana_game_answers_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kana_game_answers_item_id_index" ON "kana_game_answers" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "kana_games_mode_played_at_index" ON "kana_games" USING btree ("mode","played_at");