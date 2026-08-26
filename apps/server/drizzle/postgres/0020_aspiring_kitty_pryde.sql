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
ALTER TABLE "agents" ADD COLUMN "desired_reasoning_effort" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_action_fk" FOREIGN KEY ("server_id","action_id") REFERENCES "public"."prepared_actions"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_attentions" ADD CONSTRAINT "agent_action_attentions_created_agent_fk" FOREIGN KEY ("server_id","created_agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_action_attentions_agent_idx" ON "agent_action_attentions" USING btree ("server_id","agent_id","created_at");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_reasoning_effort" CHECK ("agents"."desired_reasoning_effort" in ('low', 'medium', 'high'));