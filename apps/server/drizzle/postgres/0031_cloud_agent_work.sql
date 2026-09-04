CREATE TABLE "cloud_agent_runs" (
	"branches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_code" text,
	"id" text PRIMARY KEY NOT NULL,
	"observed_at" timestamp with time zone,
	"provider_run_id" text,
	"raw_status" text,
	"server_id" text NOT NULL,
	"started_at" timestamp with time zone,
	"status" text DEFAULT 'queued' NOT NULL,
	"summary" text,
	"terminal_at" timestamp with time zone,
	"usage" jsonb,
	"work_id" text NOT NULL,
	CONSTRAINT "cloud_agent_runs_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "cloud_agent_runs_id_shape" CHECK ("cloud_agent_runs"."id" ~ '^car_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "cloud_agent_runs_status" CHECK ("cloud_agent_runs"."status" in ('queued', 'running', 'completed', 'failed', 'cancelled', 'expired')),
	CONSTRAINT "cloud_agent_runs_terminal_shape" CHECK (("cloud_agent_runs"."status" in ('completed', 'failed', 'cancelled', 'expired'))
                = ("cloud_agent_runs"."terminal_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "cloud_agent_work" (
	"activity_at" timestamp with time zone,
	"activity_summary" text,
	"agent_id" text NOT NULL,
	"cancel_requested_at" timestamp with time zone,
	"cancel_requested_by_agent_id" text,
	"cancel_requested_by_user_id" text,
	"chat_id" text NOT NULL,
	"computer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_agent_id" text,
	"provider_url" text,
	"repository" text NOT NULL,
	"server_id" text NOT NULL,
	"started_at" timestamp with time zone,
	"starting_ref" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"terminal_at" timestamp with time zone,
	"title" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cloud_agent_work_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "cloud_agent_work_message_key" UNIQUE("server_id","message_id"),
	CONSTRAINT "cloud_agent_work_id_shape" CHECK ("cloud_agent_work"."id" ~ '^caw_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "cloud_agent_work_provider" CHECK ("cloud_agent_work"."provider" = 'cursor'),
	CONSTRAINT "cloud_agent_work_status" CHECK ("cloud_agent_work"."status" in ('queued', 'running', 'completed', 'failed', 'cancelled', 'expired')),
	CONSTRAINT "cloud_agent_work_title_length" CHECK (char_length("cloud_agent_work"."title") between 1 and 120),
	CONSTRAINT "cloud_agent_work_repository_shape" CHECK ("cloud_agent_work"."repository" ~ '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'),
	CONSTRAINT "cloud_agent_work_activity_shape" CHECK (("cloud_agent_work"."activity_summary" is null) = ("cloud_agent_work"."activity_at" is null)
                and ("cloud_agent_work"."activity_summary" is null
                    or char_length("cloud_agent_work"."activity_summary") between 1 and 120)),
	CONSTRAINT "cloud_agent_work_cancel_shape" CHECK (("cloud_agent_work"."cancel_requested_at" is not null) = (num_nonnulls(
                "cloud_agent_work"."cancel_requested_by_user_id", "cloud_agent_work"."cancel_requested_by_agent_id"
            ) = 1)),
	CONSTRAINT "cloud_agent_work_terminal_shape" CHECK (("cloud_agent_work"."status" in ('completed', 'failed', 'cancelled', 'expired'))
                = ("cloud_agent_work"."terminal_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "chat_events" DROP CONSTRAINT "chat_events_shape";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_body_kind";--> statement-breakpoint
ALTER TABLE "chat_events" ADD COLUMN "cloud_agent_work_id" text;--> statement-breakpoint
ALTER TABLE "cloud_agent_runs" ADD CONSTRAINT "cloud_agent_runs_work_fk" FOREIGN KEY ("server_id","work_id") REFERENCES "public"."cloud_agent_work"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_agent_work" ADD CONSTRAINT "cloud_agent_work_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_agent_work" ADD CONSTRAINT "cloud_agent_work_message_fk" FOREIGN KEY ("server_id","chat_id","message_id") REFERENCES "public"."chat_messages"("server_id","chat_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_agent_work" ADD CONSTRAINT "cloud_agent_work_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_agent_work" ADD CONSTRAINT "cloud_agent_work_cancel_agent_fk" FOREIGN KEY ("server_id","cancel_requested_by_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_agent_work" ADD CONSTRAINT "cloud_agent_work_cancel_membership_fk" FOREIGN KEY ("server_id","cancel_requested_by_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_agent_work" ADD CONSTRAINT "cloud_agent_work_computer_fk" FOREIGN KEY ("server_id","computer_id") REFERENCES "public"."computers"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cloud_agent_runs_work_idx" ON "cloud_agent_runs" USING btree ("server_id","work_id","created_at");--> statement-breakpoint
CREATE INDEX "cloud_agent_work_active_idx" ON "cloud_agent_work" USING btree ("server_id","created_at") WHERE "cloud_agent_work"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "cloud_agent_work_computer_active_idx" ON "cloud_agent_work" USING btree ("computer_id","created_at") WHERE "cloud_agent_work"."status" in ('queued', 'running');--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_cloud_agent_work_fk" FOREIGN KEY ("server_id","cloud_agent_work_id") REFERENCES "public"."cloud_agent_work"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_body_kind" CHECK ("chat_messages"."body_kind" in ('text', 'ask', 'cloud-agent-work'));--> statement-breakpoint
ALTER TABLE "cloud_agent_work" ALTER CONSTRAINT "cloud_agent_work_cancel_membership_fk" DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "cloud_agent_work" ALTER CONSTRAINT "cloud_agent_work_cancel_agent_fk" DEFERRABLE INITIALLY DEFERRED;
