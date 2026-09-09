ALTER TABLE "message_tasks" DROP CONSTRAINT "message_tasks_origin";--> statement-breakpoint
ALTER TABLE "message_tasks" ADD COLUMN "tracked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "agent_inbox_notice_run_idx" ON "agent_inbox" USING btree ("agent_id","notice_run_id") WHERE "agent_inbox"."state" <> 'seen';--> statement-breakpoint
CREATE INDEX "message_tasks_open_claim_idx" ON "message_tasks" USING btree ("server_id","assignee_agent_id") WHERE "message_tasks"."origin" = 'claimed' and "message_tasks"."tracked_at" is null;--> statement-breakpoint
ALTER TABLE "message_tasks" ADD CONSTRAINT "message_tasks_origin" CHECK ("message_tasks"."origin" in ('claimed', 'composed', 'converted'));