-- An Ask's single recommended step becomes zero to four short replies the
-- addressee can send as is, the first being the Agent's recommendation. Every
-- step already written is a recommendation of one, so it migrates into a
-- one-element array. The old column allowed 200 characters and an option
-- allows 80, so a longer step is clipped rather than dropped: an option is a
-- reply, and the question it belongs to still carries the full summary.
ALTER TABLE "asks" DROP CONSTRAINT "asks_step_length";
--> statement-breakpoint
ALTER TABLE "asks" ADD COLUMN "options" text[] DEFAULT ARRAY[]::text[] NOT NULL;
--> statement-breakpoint
UPDATE "asks" SET "options" = ARRAY[left("recommended_step", 80)]
    WHERE btrim("recommended_step") <> '';
--> statement-breakpoint
ALTER TABLE "asks" DROP COLUMN "recommended_step";
--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_options_shape" CHECK (cardinality("asks"."options") <= 4
                and array_position("asks"."options", null) is null
                and array_position("asks"."options", '') is null);
