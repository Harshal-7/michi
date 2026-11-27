CREATE TABLE "mistake_clears" (
	"question_id" integer PRIMARY KEY NOT NULL,
	"cleared_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shadowing_sets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shadowing_sets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"seed_slug" text,
	"level" "jlpt_level" NOT NULL,
	"title" text NOT NULL,
	"sentences" jsonb NOT NULL,
	"seed_hash" text,
	"user_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shadowing_sets_seedSlug_unique" UNIQUE("seed_slug")
);
--> statement-breakpoint
ALTER TABLE "mistake_clears" ADD CONSTRAINT "mistake_clears_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;