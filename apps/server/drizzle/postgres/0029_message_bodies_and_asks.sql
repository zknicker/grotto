CREATE TABLE "asks" (
	"addressee_user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"answer_message_id" text,
	"answered_at" timestamp with time zone,
	"answered_by_agent_id" text,
	"answered_by_user_id" text,
	"chat_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"recommended_step" text NOT NULL,
	"server_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"summary" text NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "asks_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "asks_message_key" UNIQUE("server_id","message_id"),
	CONSTRAINT "asks_id_shape" CHECK ("asks"."id" ~ '^ask_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "asks_status" CHECK ("asks"."status" in ('open', 'answered')),
	CONSTRAINT "asks_title_length" CHECK (char_length("asks"."title") between 1 and 120),
	CONSTRAINT "asks_summary_length" CHECK (char_length("asks"."summary") between 1 and 500),
	CONSTRAINT "asks_step_length" CHECK (char_length("asks"."recommended_step") between 1 and 200),
	CONSTRAINT "asks_settlement_shape" CHECK (("asks"."status" = 'answered') = (
                "asks"."answered_at" is not null
                and "asks"."answer_message_id" is not null
                and num_nonnulls("asks"."answered_by_user_id", "asks"."answered_by_agent_id") = 1
            ))
);
--> statement-breakpoint
ALTER TABLE "chat_events" DROP CONSTRAINT "chat_events_shape";--> statement-breakpoint
ALTER TABLE "chat_events" ADD COLUMN "ask_id" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "body_kind" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_message_fk" FOREIGN KEY ("server_id","chat_id","message_id") REFERENCES "public"."chat_messages"("server_id","chat_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_answer_message_fk" FOREIGN KEY ("server_id","answer_message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_answered_by_agent_fk" FOREIGN KEY ("server_id","answered_by_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_addressee_membership_fk" FOREIGN KEY ("server_id","addressee_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_answered_by_membership_fk" FOREIGN KEY ("server_id","answered_by_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asks_addressee_open_idx" ON "asks" USING btree ("server_id","addressee_user_id","created_at") WHERE "asks"."status" = 'open';--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_ask_fk" FOREIGN KEY ("server_id","ask_id") REFERENCES "public"."asks"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_shape" CHECK ((
                ("chat_events"."event_type" = 'ask.updated'
                    AND "chat_events"."ask_id" IS NOT NULL
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
                    AND "chat_events"."sequence" = 0)
            ));--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_body_kind" CHECK ("chat_messages"."body_kind" in ('text', 'ask'));--> statement-breakpoint
ALTER TABLE "asks" ALTER CONSTRAINT "asks_addressee_membership_fk" DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "asks" ALTER CONSTRAINT "asks_answered_by_membership_fk" DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "asks" ALTER CONSTRAINT "asks_answered_by_agent_fk" DEFERRABLE INITIALLY DEFERRED;
