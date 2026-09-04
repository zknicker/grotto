-- Triggers joined the Server cascade in 0024 with immediate cross-links. A
-- Server purge deletes the Server root and lets PostgreSQL cascade through
-- every Server-owned row, so a link between two of those descendants must be
-- checked after the whole cascade rather than midway through its trigger
-- order. Ordinary parent deletes still fail at commit while a referencing row
-- remains. This is the same treatment 0002 gave the pre-Trigger cross-links.

ALTER TABLE "triggers" ALTER CONSTRAINT "triggers_owner_agent_fk" DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "triggers" ALTER CONSTRAINT "triggers_anchor_chat_fk" DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "triggers" ALTER CONSTRAINT "triggers_anchor_message_fk" DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "trigger_fires" ALTER CONSTRAINT "trigger_fires_receipt_fk" DEFERRABLE INITIALLY DEFERRED;
