CREATE TABLE "computer_system_events" (
	"command" text,
	"computer_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"reason" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_id" text NOT NULL,
	"event_type" text NOT NULL,
	CONSTRAINT "computer_system_events_id_shape" CHECK ("computer_system_events"."id" ~ '^cse_[A-Za-z0-9_-]{16}$'),
	CONSTRAINT "computer_system_events_type" CHECK ("computer_system_events"."event_type" in ('connected', 'disconnected', 'management-command')),
	CONSTRAINT "computer_system_events_shape" CHECK (("computer_system_events"."event_type" = 'management-command') = ("computer_system_events"."command" is not null)
                and ("computer_system_events"."event_type" = 'disconnected') = ("computer_system_events"."reason" is not null)),
	CONSTRAINT "computer_system_events_command" CHECK ("computer_system_events"."command" is null or "computer_system_events"."command" in ('start', 'stop', 'restart', 'upgrade', 'rollback')),
	CONSTRAINT "computer_system_events_reason" CHECK ("computer_system_events"."reason" is null or "computer_system_events"."reason" in ('heartbeat-timeout', 'socket-closed', 'server-restarted'))
);
--> statement-breakpoint
ALTER TABLE "computers" ADD COLUMN "connection_generation" text;--> statement-breakpoint
ALTER TABLE "computer_system_events" ADD CONSTRAINT "computer_system_events_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computer_system_events" ADD CONSTRAINT "computer_system_events_computer_fk" FOREIGN KEY ("server_id","computer_id") REFERENCES "public"."computers"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "computer_system_events_newest_idx" ON "computer_system_events" USING btree ("server_id","computer_id","occurred_at");--> statement-breakpoint
ALTER TABLE "computers" ADD CONSTRAINT "computers_connection_generation_shape" CHECK ("computers"."connection_generation" IS NULL OR "computers"."connection_generation" ~ '^ccn_[A-Za-z0-9_-]{16}$');