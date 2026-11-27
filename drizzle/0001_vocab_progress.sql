CREATE TYPE "public"."vocab_direction" AS ENUM('ja_en', 'en_ja');--> statement-breakpoint
CREATE TABLE "vocab_progress" (
	"item_id" integer NOT NULL,
	"direction" "vocab_direction" NOT NULL,
	"right" integer DEFAULT 0 NOT NULL,
	"wrong" integer DEFAULT 0 NOT NULL,
	"last_right" boolean NOT NULL,
	"last_at" timestamp with time zone NOT NULL,
	CONSTRAINT "vocab_progress_item_id_direction_pk" PRIMARY KEY("item_id","direction"),
	CONSTRAINT "vocab_progress_counts" CHECK ("vocab_progress"."right" >= 0 and "vocab_progress"."wrong" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vocab_progress" ADD CONSTRAINT "vocab_progress_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;