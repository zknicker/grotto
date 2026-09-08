ALTER TABLE "agent_activity" DROP CONSTRAINT "agent_activity_phase";--> statement-breakpoint
ALTER TABLE "agent_turns" DROP CONSTRAINT "agent_turns_status";--> statement-breakpoint
ALTER TABLE "agent_turns" ADD COLUMN "activity" jsonb DEFAULT '{"operations":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_phase" CHECK ("agent_activity"."phase" in ('started', 'completed', 'failed', 'interrupted'));--> statement-breakpoint
ALTER TABLE "agent_turns" ADD CONSTRAINT "agent_turns_status" CHECK ("agent_turns"."status" in ('completed', 'failed', 'interrupted'));