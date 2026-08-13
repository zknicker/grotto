CREATE TABLE "agent_activity" (
	"agent_id" text NOT NULL,
	"category" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"phase" text NOT NULL,
	"position" integer NOT NULL,
	"producer" text NOT NULL,
	"producer_id" text NOT NULL,
	"producer_sequence" integer NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_order" integer NOT NULL,
	"run_id" text NOT NULL,
	"server_id" text NOT NULL,
	"tool_ref" text,
	CONSTRAINT "agent_activity_category" CHECK ("agent_activity"."category" in ('starting_work', 'checking_messages', 'thinking', 'browsing', 'searching_web', 'reading_files', 'editing_files', 'running_command', 'using_tool', 'sending_message', 'working')),
	CONSTRAINT "agent_activity_phase" CHECK ("agent_activity"."phase" in ('started', 'completed', 'failed')),
	CONSTRAINT "agent_activity_producer" CHECK ("agent_activity"."producer" in ('server', 'computer')),
	CONSTRAINT "agent_activity_positive_position" CHECK ("agent_activity"."position" > 0),
	CONSTRAINT "agent_activity_positive_run_order" CHECK ("agent_activity"."run_order" > 0),
	CONSTRAINT "agent_activity_positive_sequence" CHECK ("agent_activity"."producer_sequence" > 0),
	CONSTRAINT "agent_activity_id_shape" CHECK ("agent_activity"."id" ~ '^aev_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "agent_activity_tool_ref" CHECK ("agent_activity"."tool_ref" is null or "agent_activity"."tool_ref" ~ '^[a-z0-9][a-z0-9._:-]*$')
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "run_id" text;--> statement-breakpoint
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_activity_idempotency_key" ON "agent_activity" USING btree ("server_id","agent_id","run_id","producer","producer_id","producer_sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_activity_position_key" ON "agent_activity" USING btree ("server_id","agent_id","run_id","position");--> statement-breakpoint
CREATE INDEX "agent_activity_agent_idx" ON "agent_activity" USING btree ("server_id","agent_id","recorded_at");--> statement-breakpoint
CREATE INDEX "agent_activity_run_position_idx" ON "agent_activity" USING btree ("server_id","agent_id","run_id","position");--> statement-breakpoint
CREATE INDEX "agent_activity_run_order_idx" ON "agent_activity" USING btree ("server_id","agent_id","run_order","position");