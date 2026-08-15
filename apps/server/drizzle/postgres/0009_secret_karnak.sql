CREATE TABLE "agent_token_usage_daily" (
	"agent_id" text NOT NULL,
	"cache_read_tokens" bigint DEFAULT 0 NOT NULL,
	"cache_write_tokens" bigint DEFAULT 0 NOT NULL,
	"date" date NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"model_id" text NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"runtime_id" text NOT NULL,
	"server_id" text NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"turn_count" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "agent_token_usage_daily_pk" PRIMARY KEY("server_id","date","agent_id","runtime_id","model_id"),
	CONSTRAINT "agent_token_usage_daily_counts" CHECK (
                "agent_token_usage_daily"."cache_read_tokens" >= 0 and
                "agent_token_usage_daily"."cache_write_tokens" >= 0 and
                "agent_token_usage_daily"."input_tokens" >= 0 and
                "agent_token_usage_daily"."output_tokens" >= 0 and
                "agent_token_usage_daily"."total_tokens" >= 0 and
                "agent_token_usage_daily"."turn_count" > 0
            )
);
--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "model_id" text;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "runtime_id" text;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "cache_read_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "cache_write_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "output_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "token_usage_reported" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "total_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_token_usage_daily" ADD CONSTRAINT "agent_token_usage_daily_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_token_usage_daily" ADD CONSTRAINT "agent_token_usage_daily_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD CONSTRAINT "agent_turns_token_counts" CHECK (
            "agent_turns"."cache_read_tokens" >= 0 and
            "agent_turns"."cache_write_tokens" >= 0 and
            "agent_turns"."input_tokens" >= 0 and
            "agent_turns"."output_tokens" >= 0 and
            "agent_turns"."total_tokens" >= 0
        );
--> statement-breakpoint
INSERT INTO "agent_token_usage_daily" (
    "server_id", "date", "agent_id", "runtime_id", "model_id", "turn_count",
    "cache_read_tokens", "cache_write_tokens", "input_tokens", "output_tokens", "total_tokens"
)
SELECT
    "server_id", ("ended_at" AT TIME ZONE 'UTC')::date, "agent_id", "runtime_id", "model_id",
    count(*), sum("cache_read_tokens"), sum("cache_write_tokens"), sum("input_tokens"),
    sum("output_tokens"), sum("total_tokens")
FROM "agent_turns"
WHERE "token_usage_reported" = true AND "runtime_id" IS NOT NULL AND "model_id" IS NOT NULL
GROUP BY "server_id", ("ended_at" AT TIME ZONE 'UTC')::date, "agent_id", "runtime_id", "model_id";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "sync_agent_token_usage_daily"() RETURNS trigger AS $$
DECLARE
    old_date date;
    new_date date;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE')
        AND OLD."token_usage_reported" = true
        AND OLD."runtime_id" IS NOT NULL
        AND OLD."model_id" IS NOT NULL THEN
        old_date := (OLD."ended_at" AT TIME ZONE 'UTC')::date;

        DELETE FROM "agent_token_usage_daily"
        WHERE "server_id" = OLD."server_id"
          AND "date" = old_date
          AND "agent_id" = OLD."agent_id"
          AND "runtime_id" = OLD."runtime_id"
          AND "model_id" = OLD."model_id"
          AND "turn_count" = 1;

        IF NOT FOUND THEN
            UPDATE "agent_token_usage_daily"
            SET
                "turn_count" = "turn_count" - 1,
                "cache_read_tokens" = "cache_read_tokens" - OLD."cache_read_tokens",
                "cache_write_tokens" = "cache_write_tokens" - OLD."cache_write_tokens",
                "input_tokens" = "input_tokens" - OLD."input_tokens",
                "output_tokens" = "output_tokens" - OLD."output_tokens",
                "total_tokens" = "total_tokens" - OLD."total_tokens"
            WHERE "server_id" = OLD."server_id"
              AND "date" = old_date
              AND "agent_id" = OLD."agent_id"
              AND "runtime_id" = OLD."runtime_id"
              AND "model_id" = OLD."model_id";
        END IF;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE')
        AND NEW."token_usage_reported" = true
        AND NEW."runtime_id" IS NOT NULL
        AND NEW."model_id" IS NOT NULL THEN
        new_date := (NEW."ended_at" AT TIME ZONE 'UTC')::date;

        INSERT INTO "agent_token_usage_daily" (
            "server_id", "date", "agent_id", "runtime_id", "model_id", "turn_count",
            "cache_read_tokens", "cache_write_tokens", "input_tokens", "output_tokens", "total_tokens"
        ) VALUES (
            NEW."server_id", new_date, NEW."agent_id", NEW."runtime_id", NEW."model_id", 1,
            NEW."cache_read_tokens", NEW."cache_write_tokens", NEW."input_tokens",
            NEW."output_tokens", NEW."total_tokens"
        )
        ON CONFLICT ("server_id", "date", "agent_id", "runtime_id", "model_id") DO UPDATE SET
            "turn_count" = "agent_token_usage_daily"."turn_count" + 1,
            "cache_read_tokens" = "agent_token_usage_daily"."cache_read_tokens" + EXCLUDED."cache_read_tokens",
            "cache_write_tokens" = "agent_token_usage_daily"."cache_write_tokens" + EXCLUDED."cache_write_tokens",
            "input_tokens" = "agent_token_usage_daily"."input_tokens" + EXCLUDED."input_tokens",
            "output_tokens" = "agent_token_usage_daily"."output_tokens" + EXCLUDED."output_tokens",
            "total_tokens" = "agent_token_usage_daily"."total_tokens" + EXCLUDED."total_tokens";
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "agent_turns_token_usage_daily_sync"
AFTER INSERT OR UPDATE OR DELETE ON "agent_turns"
FOR EACH ROW EXECUTE FUNCTION "sync_agent_token_usage_daily"();
