ALTER TABLE "agent_pending_work" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_pending_work" ADD COLUMN "seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_pending_work" ADD COLUMN "served_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_pending_work" ADD COLUMN "settled_run_id" text;--> statement-breakpoint
ALTER TABLE "agent_pending_work" ADD COLUMN "state" text DEFAULT 'queued' NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_pending_work_queued_idx" ON "agent_pending_work" USING btree ("server_id","agent_id","created_at") WHERE "agent_pending_work"."state" = 'queued';--> statement-breakpoint
ALTER TABLE "agent_pending_work" ADD CONSTRAINT "agent_pending_work_state" CHECK ("agent_pending_work"."state" in ('queued', 'accepted', 'served', 'seen'));--> statement-breakpoint
UPDATE "agent_pending_work" SET "state" = 'accepted' WHERE "run_id" IS NOT NULL;