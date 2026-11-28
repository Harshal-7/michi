CREATE TABLE "game_answers" (
	"run_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"item" text NOT NULL,
	"right" boolean NOT NULL,
	"ms" integer NOT NULL,
	"given" text DEFAULT '' NOT NULL,
	"tries" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "game_answers_run_id_position_pk" PRIMARY KEY("run_id","position")
);
--> statement-breakpoint
CREATE TABLE "game_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"game" text NOT NULL,
	"setup" text NOT NULL,
	"ranked" boolean NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"study_date" date NOT NULL,
	"cards" smallint NOT NULL,
	"first_try_right" smallint NOT NULL,
	"score" smallint NOT NULL,
	"best_streak" smallint NOT NULL,
	"mean_ms" integer,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_runs_score" CHECK ("game_runs"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "player_sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"pin_hash" text,
	"is_owner" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_nameKey_unique" UNIQUE("name_key")
);
--> statement-breakpoint
ALTER TABLE "game_answers" ADD CONSTRAINT "game_answers_run_id_game_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."game_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_runs" ADD CONSTRAINT "game_runs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_sessions" ADD CONSTRAINT "player_sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_runs_player_id_game_played_at_index" ON "game_runs" USING btree ("player_id","game","played_at");--> statement-breakpoint
CREATE INDEX "game_runs_game_setup_study_date_index" ON "game_runs" USING btree ("game","setup","study_date") WHERE "game_runs"."ranked";--> statement-breakpoint
CREATE INDEX "player_sessions_player_id_index" ON "player_sessions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "player_sessions_expires_at_index" ON "player_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "players_one_owner" ON "players" USING btree ("is_owner") WHERE "players"."is_owner";--> statement-breakpoint
-- Harshal's player row: signed in by the passphrase session, so no PIN (decision D: "Harshal").
INSERT INTO "players" ("name", "name_key", "is_owner") VALUES ('Harshal', 'harshal', true);--> statement-breakpoint
-- Harshal's kana games so far, as owner runs (decision G). The old tables stay one more release.
-- The setup names what was played; the standard setups here match KANA_SETUPS in src/lib/games/kana/setups.ts.
INSERT INTO "game_runs" ("id", "player_id", "game", "setup", "ranked", "played_at", "study_date", "cards", "first_try_right", "score", "best_streak", "mean_ms", "duration_ms", "created_at")
SELECT g."id", o."id", 'kana', s."setup",
  NOT g."weakest" AND s."setup" IN (
    'read:hiragana:basic:20', 'read:katakana:basic:20', 'read:hiragana+katakana:basic+dakuten+combo+extended:50',
    'find:hiragana:basic:20', 'find:katakana:basic:20', 'find:hiragana+katakana:basic+dakuten+combo+extended:50'),
  g."played_at", g."study_date", g."cards", g."first_try_right", g."score", g."best_streak", g."mean_ms", g."duration_ms", g."created_at"
FROM "kana_games" g
CROSS JOIN (SELECT "id" FROM "players" WHERE "is_owner") o
CROSS JOIN LATERAL (
  SELECT CASE WHEN g."weakest" THEN g."mode" || ':weakest:' || g."cards"
    ELSE g."mode" || ':' || array_to_string(g."scripts", '+') || ':' || array_to_string(g."groups", '+') || ':' || g."cards" END AS "setup"
) s
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "game_answers" ("run_id", "position", "item", "right", "ms", "given", "tries")
SELECT a."game_id", a."position", i."seed_slug", a."right", a."ms", a."given", a."tries"
FROM "kana_game_answers" a
JOIN "items" i ON i."id" = a."item_id"
WHERE i."seed_slug" IS NOT NULL
ON CONFLICT DO NOTHING;
