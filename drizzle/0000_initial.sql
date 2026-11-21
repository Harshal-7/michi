CREATE TYPE "public"."activity_kind" AS ENUM('class', 'speaking', 'shadowing', 'listening', 'reading', 'immersion', 'study', 'other');--> statement-breakpoint
CREATE TYPE "public"."activity_skill" AS ENUM('listening', 'speaking', 'reading', 'vocabulary', 'kanji', 'grammar', 'general');--> statement-breakpoint
CREATE TYPE "public"."assessment_kind" AS ENUM('daily', 'weekly', 'mock', 'outside');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('open', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."card_state" AS ENUM('new', 'learning', 'review', 'relearning');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."card_type" AS ENUM('recognition', 'production', 'fill_in');--> statement-breakpoint
CREATE TYPE "public"."deck_source" AS ENUM('starter', 'class', 'immersion', 'user');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."grammar_status" AS ENUM('not_started', 'learning', 'confident');--> statement-breakpoint
CREATE TYPE "public"."immersion_kind" AS ENUM('anime', 'drama', 'song', 'podcast', 'nhk_easy', 'youtube', 'book', 'game', 'other');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('kana', 'kanji', 'word', 'grammar', 'phrase');--> statement-breakpoint
CREATE TYPE "public"."item_source" AS ENUM('starter', 'class', 'import', 'immersion', 'manual');--> statement-breakpoint
CREATE TYPE "public"."jlpt_level" AS ENUM('N5', 'N4', 'N3');--> statement-breakpoint
CREATE TYPE "public"."level_or_work" AS ENUM('N5', 'N4', 'N3', 'work');--> statement-breakpoint
CREATE TYPE "public"."override_kind" AS ENUM('rest', 'no_class', 'exam');--> statement-breakpoint
CREATE TYPE "public"."pace_mode" AS ENUM('deadline', 'per_day');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('kana', 'kanji_reading', 'spelling', 'meaning', 'meaning_reverse', 'word_in_context', 'grammar_fill', 'sentence_order', 'paraphrase', 'usage', 'text_grammar', 'reading', 'listening');--> statement-breakpoint
CREATE TYPE "public"."quick_check_verdict" AS ENUM('known', 'unsure', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."resource_skill" AS ENUM('kana', 'kanji', 'grammar', 'vocabulary', 'listening', 'reading', 'speaking', 'jlpt', 'business', 'it', 'general');--> statement-breakpoint
CREATE TYPE "public"."resource_source" AS ENUM('starter', 'manual');--> statement-breakpoint
CREATE TYPE "public"."review_source" AS ENUM('session', 'quiz', 'quick_check');--> statement-breakpoint
CREATE TYPE "public"."subtitles" AS ENUM('none', 'ja', 'en');--> statement-breakpoint
CREATE TYPE "public"."task_mark" AS ENUM('done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."track" AS ENUM('jlpt', 'work');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"study_date" date NOT NULL,
	"kind" "activity_kind" NOT NULL,
	"skill" "activity_skill" NOT NULL,
	"minutes" smallint NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"immersion_entry_id" integer,
	"class_log_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_logs_minutes" CHECK ("activity_logs"."minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assessments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" "assessment_kind" NOT NULL,
	"level" "jlpt_level",
	"status" "assessment_status" DEFAULT 'open' NOT NULL,
	"study_date" date NOT NULL,
	"week_start" date,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"score" integer,
	"total" integer,
	"sections" jsonb,
	"outside_source" text,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"device" text DEFAULT 'device' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_overrides" (
	"date" date PRIMARY KEY NOT NULL,
	"kind" "override_kind" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_id" integer NOT NULL,
	"card_type" "card_type" NOT NULL,
	"status" "card_status" DEFAULT 'active' NOT NULL,
	"state" "card_state" DEFAULT 'new' NOT NULL,
	"fsrs" jsonb,
	"due_at" timestamp with time zone,
	"stability" real,
	"difficulty" real,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"last_review_at" timestamp with time zone,
	"last_review_id" uuid,
	"new_rank" integer DEFAULT 0 NOT NULL,
	"introduced_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_log_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "class_log_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"class_log_id" integer NOT NULL,
	"kind" "item_kind" NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"input" jsonb NOT NULL,
	"item_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "class_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"lesson" text DEFAULT '' NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_plans" (
	"study_date" date PRIMARY KEY NOT NULL,
	"plan" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rebuilt_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deck_items" (
	"deck_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_items_deck_id_item_id_pk" PRIMARY KEY("deck_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "decks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "decks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text,
	"name" text NOT NULL,
	"source" "deck_source" NOT NULL,
	"kind" "item_kind",
	"level" "jlpt_level",
	"track" "track" DEFAULT 'jlpt' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"unlock_on" date,
	"pace_mode" "pace_mode" DEFAULT 'deadline' NOT NULL,
	"pace_per_day" smallint,
	"deadline" date,
	"card_types" "card_type"[] DEFAULT '{recognition}' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "dictionary" (
	"id" text PRIMARY KEY NOT NULL,
	"kanji" text[] NOT NULL,
	"kana" text[] NOT NULL,
	"meanings" text[] NOT NULL,
	"pos" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flags" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "flags_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_id" integer,
	"question_id" integer,
	"target" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "grammar_progress" (
	"item_id" integer PRIMARY KEY NOT NULL,
	"status" "grammar_status" DEFAULT 'not_started' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "immersion_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "immersion_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"study_date" date NOT NULL,
	"kind" "immersion_kind" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"minutes" smallint NOT NULL,
	"subtitles" "subtitles" DEFAULT 'none' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "immersion_words" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "immersion_words_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entry_id" integer NOT NULL,
	"term" text NOT NULL,
	"reading" text,
	"meaning" text DEFAULT '' NOT NULL,
	"sentence" text,
	"item_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_contexts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "item_contexts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_id" integer NOT NULL,
	"ja" text NOT NULL,
	"en" text DEFAULT '' NOT NULL,
	"class_log_id" integer,
	"immersion_entry_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" "item_kind" NOT NULL,
	"level" "jlpt_level",
	"track" "track" DEFAULT 'jlpt' NOT NULL,
	"term" text NOT NULL,
	"reading" text,
	"meaning" text DEFAULT '' NOT NULL,
	"source" "item_source" NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text NOT NULL,
	"seed_slug" text,
	"seed_hash" text,
	"user_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_seedSlug_unique" UNIQUE("seed_slug")
);
--> statement-breakpoint
CREATE TABLE "kanji_info" (
	"kanji" text PRIMARY KEY NOT NULL,
	"meanings" text[] NOT NULL,
	"on" text[] NOT NULL,
	"kun" text[] NOT NULL,
	"strokes" smallint NOT NULL,
	"grade" smallint,
	"jlpt" "jlpt_level"
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "passages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"seed_slug" text,
	"level" "jlpt_level" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"translation" text DEFAULT '' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seed_hash" text,
	"user_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passages_seedSlug_unique" UNIQUE("seed_slug")
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prompts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"seed_slug" text,
	"level" "level_or_work" NOT NULL,
	"prompt" text NOT NULL,
	"hints" text[] DEFAULT '{}' NOT NULL,
	"model" text NOT NULL,
	"model_en" text NOT NULL,
	"seed_hash" text,
	"user_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompts_seedSlug_unique" UNIQUE("seed_slug")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "push_subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"device" text DEFAULT 'device' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sent_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "question_bank" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "question_bank_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"seed_slug" text,
	"level" "jlpt_level" NOT NULL,
	"type" "question_type" NOT NULL,
	"passage_id" integer,
	"data" jsonb NOT NULL,
	"seed_hash" text,
	"user_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_bank_seedSlug_unique" UNIQUE("seed_slug")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"assessment_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"type" "question_type" NOT NULL,
	"section" text,
	"item_id" integer,
	"bank_question_id" integer,
	"asked" jsonb NOT NULL,
	"answer" text,
	"correct" boolean,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quick_check" (
	"item_id" integer PRIMARY KEY NOT NULL,
	"verdict" "quick_check_verdict" NOT NULL,
	"verified" boolean,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "resources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"seed_slug" text,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"skill" "resource_skill" NOT NULL,
	"levels" "level_or_work"[] NOT NULL,
	"free" boolean NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"favourite" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"removed_at" timestamp with time zone,
	"source" "resource_source" NOT NULL,
	"seed_hash" text,
	"user_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_seedSlug_unique" UNIQUE("seed_slug")
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"card_id" integer NOT NULL,
	"rating" smallint NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"duration_ms" integer,
	"source" "review_source" NOT NULL,
	"study_date" date GENERATED ALWAYS AS ((((reviewed_at at time zone 'UTC') + interval '90 minutes')::date)) STORED NOT NULL,
	"card_before" jsonb NOT NULL,
	"log" jsonb,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_logs_rating" CHECK ("review_logs"."rating" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "seed_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "seed_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"content_hash" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_one_row" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "sign_in_attempts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sign_in_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"ok" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_overrides" (
	"study_date" date NOT NULL,
	"task_key" text NOT NULL,
	"mark" "task_mark" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_overrides_study_date_task_key_pk" PRIMARY KEY("study_date","task_key")
);
--> statement-breakpoint
CREATE TABLE "user_sentences" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_sentences_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_id" integer NOT NULL,
	"ja" text NOT NULL,
	"en" text DEFAULT '' NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_immersion_entry_id_immersion_entries_id_fk" FOREIGN KEY ("immersion_entry_id") REFERENCES "public"."immersion_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_class_log_id_class_logs_id_fk" FOREIGN KEY ("class_log_id") REFERENCES "public"."class_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_log_entries" ADD CONSTRAINT "class_log_entries_class_log_id_class_logs_id_fk" FOREIGN KEY ("class_log_id") REFERENCES "public"."class_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_log_entries" ADD CONSTRAINT "class_log_entries_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_items" ADD CONSTRAINT "deck_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grammar_progress" ADD CONSTRAINT "grammar_progress_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "immersion_words" ADD CONSTRAINT "immersion_words_entry_id_immersion_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."immersion_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "immersion_words" ADD CONSTRAINT "immersion_words_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_contexts" ADD CONSTRAINT "item_contexts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_contexts" ADD CONSTRAINT "item_contexts_class_log_id_class_logs_id_fk" FOREIGN KEY ("class_log_id") REFERENCES "public"."class_logs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_contexts" ADD CONSTRAINT "item_contexts_immersion_entry_id_immersion_entries_id_fk" FOREIGN KEY ("immersion_entry_id") REFERENCES "public"."immersion_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_bank" ADD CONSTRAINT "question_bank_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_bank_question_id_question_bank_id_fk" FOREIGN KEY ("bank_question_id") REFERENCES "public"."question_bank"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_check" ADD CONSTRAINT "quick_check_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sentences" ADD CONSTRAINT "user_sentences_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_study_date_index" ON "activity_logs" USING btree ("study_date");--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_one_daily_per_date" ON "assessments" USING btree ("study_date") WHERE "assessments"."kind" = 'daily';--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_one_weekly_per_week" ON "assessments" USING btree ("week_start") WHERE "assessments"."kind" = 'weekly';--> statement-breakpoint
CREATE UNIQUE INDEX "assessments_one_open_mock_per_level" ON "assessments" USING btree ("level") WHERE "assessments"."kind" = 'mock' and "assessments"."status" = 'open';--> statement-breakpoint
CREATE INDEX "assessments_kind_study_date_index" ON "assessments" USING btree ("kind","study_date");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_index" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_item_id_card_type_index" ON "cards" USING btree ("item_id","card_type");--> statement-breakpoint
CREATE INDEX "cards_due_idx" ON "cards" USING btree ("due_at") WHERE "cards"."status" = 'active' and "cards"."state" <> 'new';--> statement-breakpoint
CREATE INDEX "cards_new_idx" ON "cards" USING btree ("new_rank") WHERE "cards"."status" = 'active' and "cards"."state" = 'new';--> statement-breakpoint
CREATE INDEX "class_log_entries_class_log_id_index" ON "class_log_entries" USING btree ("class_log_id");--> statement-breakpoint
CREATE INDEX "class_log_entries_item_id_index" ON "class_log_entries" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "class_logs_date_index" ON "class_logs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "deck_items_item_id_index" ON "deck_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "dictionary_kanji_index" ON "dictionary" USING gin ("kanji");--> statement-breakpoint
CREATE INDEX "dictionary_kana_index" ON "dictionary" USING gin ("kana");--> statement-breakpoint
CREATE INDEX "immersion_entries_study_date_index" ON "immersion_entries" USING btree ("study_date");--> statement-breakpoint
CREATE INDEX "immersion_words_entry_id_index" ON "immersion_words" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "item_contexts_item_id_index" ON "item_contexts" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_kind_dedupe_key_index" ON "items" USING btree ("kind","dedupe_key");--> statement-breakpoint
CREATE INDEX "items_kind_level_index" ON "items" USING btree ("kind","level");--> statement-breakpoint
CREATE INDEX "question_bank_level_type_index" ON "question_bank" USING btree ("level","type");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_assessment_id_position_index" ON "questions" USING btree ("assessment_id","position");--> statement-breakpoint
CREATE INDEX "questions_item_id_index" ON "questions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "questions_type_correct_index" ON "questions" USING btree ("type","correct");--> statement-breakpoint
CREATE INDEX "review_logs_card_id_reviewed_at_index" ON "review_logs" USING btree ("card_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "review_logs_study_date_index" ON "review_logs" USING btree ("study_date");--> statement-breakpoint
CREATE INDEX "sign_in_attempts_key_at_index" ON "sign_in_attempts" USING btree ("key","at");--> statement-breakpoint
CREATE INDEX "sign_in_attempts_at_index" ON "sign_in_attempts" USING btree ("at");--> statement-breakpoint
CREATE INDEX "user_sentences_item_id_index" ON "user_sentences" USING btree ("item_id");