ALTER TABLE "chat_events" DROP CONSTRAINT "chat_events_shape";--> statement-breakpoint
DROP INDEX "message_reactions_actor_key";--> statement-breakpoint
ALTER TABLE "message_reactions" ALTER COLUMN "actor_agent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD COLUMN "actor_user_id" text;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_actor_user_fk" FOREIGN KEY ("server_id","actor_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_user_key" ON "message_reactions" USING btree ("server_id","message_id","actor_user_id","emoji") WHERE "message_reactions"."actor_user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "message_reactions_actor_key" ON "message_reactions" USING btree ("server_id","message_id","actor_agent_id","emoji") WHERE "message_reactions"."actor_agent_id" is not null;--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_shape" CHECK ((
                ("chat_events"."event_type" = 'ask.updated'
                    AND "chat_events"."ask_id" IS NOT NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" > 0)
                OR
                ("chat_events"."event_type" = 'prepared-action.updated'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."action_id" IS NOT NULL
                    AND "chat_events"."action_status" IN ('pending', 'executed', 'superseded')
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
                    AND "chat_events"."label_id" IS NOT NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."ask_id" IS NULL
                    AND "chat_events"."cloud_agent_work_id" IS NULL
                    AND "chat_events"."sequence" = 0)
            ));--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_actor_shape" CHECK (num_nonnulls("message_reactions"."actor_agent_id", "message_reactions"."actor_user_id") = 1);