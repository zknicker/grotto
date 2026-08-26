CREATE TABLE "agent_action_attentions" (
	"action_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"created_agent_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text NOT NULL,
	"executed_result" jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"source" text DEFAULT 'action' NOT NULL,
	CONSTRAINT "agent_action_attentions_server_action_key" UNIQUE("server_id","action_id"),
	CONSTRAINT "agent_action_attentions_server_dedupe_key" UNIQUE("server_id","agent_id","dedupe_key"),
	CONSTRAINT "agent_action_attentions_id_shape" CHECK ("agent_action_attentions"."id" ~ '^aat_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "agent_action_attentions_source" CHECK ("agent_action_attentions"."source" = 'action')
);
--> statement-breakpoint
CREATE TABLE "prepared_action_media" (
	"action_id" text NOT NULL,
	"byte_size" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"media_type" text NOT NULL,
	"sha256" text NOT NULL,
	"server_id" text NOT NULL,
	CONSTRAINT "prepared_action_media_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "prepared_action_media_id_shape" CHECK ("prepared_action_media"."id" ~ '^pam_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "prepared_action_media_type" CHECK ("prepared_action_media"."media_type" in ('image/jpeg', 'image/png', 'image/webp')),
	CONSTRAINT "prepared_action_media_size" CHECK ("prepared_action_media"."byte_size" > 0 and "prepared_action_media"."byte_size" <= 524288),
	CONSTRAINT "prepared_action_media_sha256" CHECK ("prepared_action_media"."sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "prepared_actions" (
	"chat_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"executed_at" timestamp with time zone,
	"executed_by_user_id" text,
	"executed_result" jsonb,
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"message_id" text NOT NULL,
	"nonce" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"proposer_agent_id" text NOT NULL,
	"server_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"superseded_at" timestamp with time zone,
	"superseded_by_action_id" text,
	CONSTRAINT "prepared_actions_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "prepared_actions_id_shape" CHECK ("prepared_actions"."id" ~ '^act_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "prepared_actions_status" CHECK ("prepared_actions"."status" in ('pending', 'executed', 'superseded')),
	CONSTRAINT "prepared_actions_superseded_shape" CHECK (("prepared_actions"."status" = 'superseded') = ("prepared_actions"."superseded_at" is not null and "prepared_actions"."superseded_by_action_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "chat_events" DROP CONSTRAINT "chat_events_shape";--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "desired_reasoning_effort" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_events" ADD COLUMN "action_id" text;--> statement-breakpoint
ALTER TABLE "chat_events" ADD COLUMN "action_status" text;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_action_fk" FOREIGN KEY ("server_id","action_id") REFERENCES "public"."prepared_actions"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_created_agent_fk" FOREIGN KEY ("server_id","created_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepared_action_media" ADD CONSTRAINT "prepared_action_media_action_fk" FOREIGN KEY ("server_id","action_id") REFERENCES "public"."prepared_actions"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepared_actions" ADD CONSTRAINT "prepared_actions_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepared_actions" ADD CONSTRAINT "prepared_actions_message_fk" FOREIGN KEY ("server_id","chat_id","message_id") REFERENCES "public"."chat_messages"("server_id","chat_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepared_actions" ADD CONSTRAINT "prepared_actions_proposer_fk" FOREIGN KEY ("server_id","proposer_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepared_actions" ADD CONSTRAINT "prepared_actions_executor_membership_fk" FOREIGN KEY ("server_id","executed_by_user_id") REFERENCES "public"."server_memberships"("server_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepared_actions" ALTER CONSTRAINT "prepared_actions_executor_membership_fk" DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
CREATE INDEX "agent_action_attentions_agent_idx" ON "agent_action_attentions" USING btree ("server_id","agent_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "prepared_action_media_action_key" ON "prepared_action_media" USING btree ("server_id","action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prepared_actions_message_key" ON "prepared_actions" USING btree ("server_id","chat_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prepared_actions_nonce_key" ON "prepared_actions" USING btree ("server_id","proposer_agent_id","nonce");--> statement-breakpoint
CREATE INDEX "prepared_actions_pending_idx" ON "prepared_actions" USING btree ("server_id","chat_id","proposer_agent_id","kind","created_at") WHERE "prepared_actions"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_prepared_action_fk" FOREIGN KEY ("server_id","action_id") REFERENCES "public"."prepared_actions"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_reasoning_effort" CHECK ("agents"."desired_reasoning_effort" in ('low', 'medium', 'high'));--> statement-breakpoint
ALTER TABLE "chat_events" ADD CONSTRAINT "chat_events_shape" CHECK ((
                ("chat_events"."event_type" = 'message.created'
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
                ("chat_events"."event_type" = 'prepared-action.updated'
                    AND "chat_events"."chat_id" IS NOT NULL
                    AND "chat_events"."message_id" IS NOT NULL
                    AND "chat_events"."action_id" IS NOT NULL
                    AND "chat_events"."action_status" IN ('pending', 'executed', 'superseded')
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
                    AND "chat_events"."action_id" IS NULL
                    AND "chat_events"."action_status" IS NULL
                    AND "chat_events"."label_id" IS NULL
                    AND "chat_events"."reader_user_id" IS NULL
                    AND "chat_events"."reminder_id" IS NULL
                    AND "chat_events"."reminder_action" IS NULL
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
                    AND "chat_events"."sequence" = 0)
            ));
