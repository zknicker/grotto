-- The chat-message visibility invariant: if a row is in `chat_messages`, a
-- human can read it. Agent-only deliveries (automation fires, task assignment
-- handoffs) are typed pending work keyed by their own identity, never hidden
-- Chat rows. This migration retires every author that only ever existed to
-- carry an Agent-facing receipt: `reminder`, `trigger`, and `task`.
--
-- Order matters. The four `*_receipt_message_id` links must go before the
-- legacy rows they point at, and the author CHECK must be rebuilt after the
-- rows that violate it are gone.

ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_author_shape";--> statement-breakpoint
ALTER TABLE "reminder_agent_attention" DROP CONSTRAINT "reminder_agent_attention_receipt_fk";--> statement-breakpoint
ALTER TABLE "reminder_fires" DROP CONSTRAINT "reminder_fires_receipt_fk";--> statement-breakpoint
ALTER TABLE "reminders" DROP CONSTRAINT "reminders_schedule_receipt_fk";--> statement-breakpoint
ALTER TABLE "trigger_fires" DROP CONSTRAINT "trigger_fires_receipt_fk";--> statement-breakpoint
ALTER TABLE "reminder_agent_attention" DROP COLUMN "receipt_message_id";--> statement-breakpoint
ALTER TABLE "reminder_fires" DROP COLUMN "receipt_message_id";--> statement-breakpoint
ALTER TABLE "reminders" DROP COLUMN "schedule_receipt_message_id";--> statement-breakpoint
ALTER TABLE "trigger_fires" DROP COLUMN "receipt_message_id";--> statement-breakpoint
ALTER TABLE "triggers" ALTER COLUMN "anchor_message_id" DROP NOT NULL;--> statement-breakpoint

-- 0002 and 0026 made several links into `chat_messages` DEFERRABLE INITIALLY
-- DEFERRED, so the deletes below would queue constraint-trigger events until
-- commit -- and PostgreSQL refuses to ALTER a table that has pending trigger
-- events, which is exactly what the rebuilt author CHECK needs to do. Checking
-- every link at its own statement drains the queue as we go; the delete order
-- below already satisfies immediate checking.
SET CONSTRAINTS ALL IMMEDIATE;--> statement-breakpoint

-- A Trigger anchored on its own creation receipt was wired by a human, so its
-- DM chat is the anchor and it needs no anchor message at all.
UPDATE "triggers" SET "anchor_message_id" = NULL
WHERE "anchor_message_id" IN (
    SELECT "id" FROM "chat_messages" WHERE "system_author" IN ('reminder', 'trigger', 'task')
);--> statement-breakpoint

-- Queued Agent work keyed by a legacy receipt can never be served again; it
-- would replay on every wake forever.
DELETE FROM "agent_pending_work"
WHERE "dedupe_key" IN (
    SELECT "id" FROM "chat_messages" WHERE "system_author" IN ('reminder', 'trigger', 'task')
);--> statement-breakpoint

-- A Reminder anchored on a legacy receipt loses its anchor with it, and a
-- Reminder with no anchor cannot fire.
DELETE FROM "reminders"
WHERE "anchor_message_id" IN (
    SELECT "id" FROM "chat_messages" WHERE "system_author" IN ('reminder', 'trigger', 'task')
);--> statement-breakpoint

DELETE FROM "chat_messages" WHERE "system_author" IN ('reminder', 'trigger', 'task');--> statement-breakpoint

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_shape" CHECK ((
                ("chat_messages"."author_user_id" is not null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_agent_id" is not null and "chat_messages"."author_user_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_user_id" is null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" in ('session'))
            ));
