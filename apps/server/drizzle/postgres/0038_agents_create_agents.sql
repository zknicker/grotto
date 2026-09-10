-- The prepared-action lane is retired: its events cannot satisfy the
-- rewritten chat_events_shape, so they go before the constraint returns.
DELETE FROM "chat_events" WHERE "event_type" = 'prepared-action.updated';--> statement-breakpoint
-- Its queue rows go too. A pending action attention is a bodiless inbox row
-- keyed by an action id, and nothing left in the delivery path can resolve one:
-- it would reach the Agent as an empty message from a sender named "action".
DELETE FROM "agent_inbox" WHERE "source" = 'action';--> statement-breakpoint
-- The referencing constraint goes before the tables it points at.
ALTER TABLE "chat_events" DROP CONSTRAINT "chat_events_prepared_action_fk";--> statement-breakpoint
ALTER TABLE "agent_action_attentions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prepared_action_media" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prepared_actions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "agent_action_attentions" CASCADE;--> statement-breakpoint
DROP TABLE "prepared_action_media" CASCADE;--> statement-breakpoint
DROP TABLE "prepared_actions" CASCADE;--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT "agents_role";--> statement-breakpoint
ALTER TABLE "chat_events" DROP CONSTRAINT "chat_events_shape";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_body_kind";--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "brief" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "created_by_agent_id" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "creation_message_id" text;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_agent_fk" FOREIGN KEY ("server_id","created_by_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_creation_message_fk" FOREIGN KEY ("server_id","creation_message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "chat_events" DROP COLUMN "action_id";--> statement-breakpoint
ALTER TABLE "chat_events" DROP COLUMN "action_status";--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_creation_message_key" UNIQUE("server_id","creation_message_id");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_brief_length" CHECK ("agents"."brief" is null or char_length("agents"."brief") between 1 and 4000);--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_shape" CHECK ((
                ("chat_events"."event_type" = 'ask.updated'
                    AND "chat_events"."ask_id" IS NOT NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."sequence" > 0)
                OR
                ("chat_events"."event_type" = 'cloud-agent-work.updated'
                    AND "chat_events"."cloud_agent_work_id" IS NOT NULL
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."sequence" > 0)
                OR
                ("chat_events"."event_type" = 'message.created'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" > 0)
                OR
                ("chat_events"."event_type" = 'message.reaction.updated'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" > 0)
                OR
                ("chat_events"."event_type" = 'chat.lifecycle'
                    AND "chat_events"."chat_id" IS NULL
                    AND "chat_events"."lifecycle_chat_id" IS NOT NULL
                    AND "chat_events"."chat_action" IN (
                        'archived', 'created', 'deleted', 'unarchived', 'updated'
                    )
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" = 0)
                OR
                ("chat_events"."event_type" IN ('task.created', 'task.updated')
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" > 0)
                OR
                ("chat_events"."event_type" = 'chat.read'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NOT NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" >= 0)
                OR
                ("chat_events"."event_type" = 'thread.follow.updated'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NOT NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" >= 0)
                OR
                ("chat_events"."event_type" = 'reminder.changed'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NOT NULL
                    AND "chat_events"."reminder_action" IN (
                        'scheduled', 'updated', 'snoozed', 'canceled', 'fired'
                    )
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" >= 0)
                OR
                ("chat_events"."event_type" = 'task.label.updated'
                    AND "chat_events"."chat_id" IS NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NOT NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" = 0)
            ));--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_body_kind" CHECK ("chat_messages"."body_kind" in ('text', 'ask', 'cloud-agent-work', 'agent-created'));
--> statement-breakpoint
-- Server deletion drops the cascade in any order, so every internal link
-- inside it defers (0002_defer-server-purge-constraints.sql).
ALTER TABLE "agents" ALTER CONSTRAINT "agents_created_by_agent_fk" DEFERRABLE INITIALLY DEFERRED;
