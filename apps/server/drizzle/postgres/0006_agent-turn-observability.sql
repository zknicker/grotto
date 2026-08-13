ALTER TABLE "agent_turns" ADD COLUMN "failure_kind" text;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "output_produced" boolean DEFAULT false NOT NULL;