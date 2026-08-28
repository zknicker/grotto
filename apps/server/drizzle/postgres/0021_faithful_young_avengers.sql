ALTER TABLE "agents" ADD COLUMN "effective_grotto_agent_applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "effective_grotto_agent_status" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "effective_grotto_agent_version" text;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_grotto_agent_status" CHECK ("agents"."effective_grotto_agent_status" is null or "agents"."effective_grotto_agent_status" in ('current', 'failed', 'pending'));