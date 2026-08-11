ALTER TABLE "chat_events" DROP CONSTRAINT "chat_events_shape";--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_shape" CHECK ((
                ("chat_events"."event_type" = 'message.created'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
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
                    AND "chat_events"."sequence" = 0)
                OR
                ("chat_events"."event_type" IN ('task.created', 'task.updated')
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."sequence" > 0)
                OR
                ("chat_events"."event_type" = 'chat.read'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NOT NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."sequence" >= 0)
                OR
                ("chat_events"."event_type" = 'thread.follow.updated'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NOT NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
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
                    AND "chat_events"."sequence" >= 0)
                OR
                ("chat_events"."event_type" = 'task.label.updated'
                    AND "chat_events"."chat_id" IS NULL
                    AND "chat_events"."message_id" IS NULL
                    AND "chat_events"."label_id" IS NOT NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
                    AND "chat_events"."sequence" = 0)
            ));