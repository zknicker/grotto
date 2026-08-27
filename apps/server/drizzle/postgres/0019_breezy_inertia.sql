ALTER TABLE "agent_delivery" DROP CONSTRAINT "agent_delivery_active_run";--> statement-breakpoint
ALTER TABLE "agent_delivery" ADD COLUMN "active_run_reasoning_effort" text;--> statement-breakpoint
UPDATE "agent_delivery" AS "delivery"
SET "active_run_reasoning_effort" = "agents"."desired_reasoning_effort"
FROM "agents"
WHERE "delivery"."agent_id" = "agents"."id"
  AND "delivery"."active_run_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_delivery" ADD CONSTRAINT "agent_delivery_active_run_reasoning_effort" CHECK ("agent_delivery"."active_run_reasoning_effort" is null or "agent_delivery"."active_run_reasoning_effort" in ('low', 'medium', 'high'));--> statement-breakpoint
ALTER TABLE "agent_delivery" ADD CONSTRAINT "agent_delivery_active_run" CHECK ((
                "agent_delivery"."active_run_id" is null
                and "agent_delivery"."active_run_chat_id" is null
                and "agent_delivery"."active_run_computer_id" is null
                and "agent_delivery"."active_run_runtime_id" is null
                and "agent_delivery"."active_run_model_id" is null
                and "agent_delivery"."active_run_reasoning_effort" is null
                and "agent_delivery"."accepted_at" is null
                and "agent_delivery"."dispatched_at" is null
            ) or (
                "agent_delivery"."active_run_id" is not null
                and "agent_delivery"."active_run_chat_id" is not null
                and "agent_delivery"."active_run_computer_id" is not null
                and "agent_delivery"."active_run_runtime_id" is not null
                and "agent_delivery"."active_run_model_id" is not null
                and "agent_delivery"."active_run_reasoning_effort" is not null
            ));
