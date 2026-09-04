CREATE TABLE "trigger_fires" (
	"content_type" text,
	"dedupe_key" text,
	"id" text PRIMARY KEY NOT NULL,
	"payload" text NOT NULL,
	"payload_bytes" integer NOT NULL,
	"receipt_message_id" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"server_id" text NOT NULL,
	"trigger_id" text NOT NULL,
	CONSTRAINT "trigger_fires_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "trigger_fires_payload_size" CHECK (octet_length("trigger_fires"."payload") <= 65536
                and "trigger_fires"."payload_bytes" = octet_length("trigger_fires"."payload")),
	CONSTRAINT "trigger_fires_dedupe_key_length" CHECK ("trigger_fires"."dedupe_key" is null or char_length("trigger_fires"."dedupe_key") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "triggers" (
	"anchor_chat_id" text NOT NULL,
	"anchor_message_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by_user_id" text,
	"disabled_at" timestamp with time zone,
	"fire_count" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"instruction" text,
	"kind" text NOT NULL,
	"last_fired_at" timestamp with time zone,
	"owner_agent_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"server_id" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "triggers_server_id_key" UNIQUE("server_id","id"),
	CONSTRAINT "triggers_kind" CHECK ("triggers"."kind" in ('webhook')),
	CONSTRAINT "triggers_status" CHECK ("triggers"."status" in ('armed', 'disabled')),
	CONSTRAINT "triggers_positive_version" CHECK ("triggers"."version" > 0),
	CONSTRAINT "triggers_nonnegative_fire_count" CHECK ("triggers"."fire_count" >= 0),
	CONSTRAINT "triggers_title_length" CHECK (char_length("triggers"."title") between 1 and 200),
	CONSTRAINT "triggers_instruction_size" CHECK ("triggers"."instruction" is null or (
                octet_length("triggers"."instruction") between 1 and 4096
            ))
);
--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_author_shape";--> statement-breakpoint
ALTER TABLE "trigger_fires" ADD CONSTRAINT "trigger_fires_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trigger_fires" ADD CONSTRAINT "trigger_fires_trigger_fk" FOREIGN KEY ("server_id","trigger_id") REFERENCES "public"."triggers"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trigger_fires" ADD CONSTRAINT "trigger_fires_receipt_fk" FOREIGN KEY ("server_id","receipt_message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_owner_agent_fk" FOREIGN KEY ("server_id","owner_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_anchor_chat_fk" FOREIGN KEY ("server_id","anchor_chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_anchor_message_fk" FOREIGN KEY ("server_id","anchor_chat_id","anchor_message_id") REFERENCES "public"."chat_messages"("server_id","chat_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trigger_fires_dedupe_key" ON "trigger_fires" USING btree ("server_id","trigger_id","dedupe_key") WHERE "trigger_fires"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "trigger_fires_trigger_idx" ON "trigger_fires" USING btree ("server_id","trigger_id","received_at");--> statement-breakpoint
CREATE INDEX "triggers_owner_idx" ON "triggers" USING btree ("server_id","owner_agent_id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_shape" CHECK ((
                ("chat_messages"."author_user_id" is not null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_agent_id" is not null and "chat_messages"."author_user_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_user_id" is null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" in ('reminder', 'session', 'task', 'trigger'))
            ));