CREATE TABLE "message_causes" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"message_id" text PRIMARY KEY NOT NULL,
	"reminder_fire_id" text,
	"reminder_id" text,
	"server_id" text NOT NULL,
	"trigger_fire_id" text,
	"trigger_id" text,
	CONSTRAINT "message_causes_kind" CHECK ("message_causes"."kind" in ('reminder_fire', 'trigger_fire')),
	CONSTRAINT "message_causes_shape" CHECK ((
                "message_causes"."kind" = 'trigger_fire'
                and "message_causes"."trigger_id" is not null
                and "message_causes"."trigger_fire_id" is not null
                and "message_causes"."reminder_id" is null
                and "message_causes"."reminder_fire_id" is null
            ) or (
                "message_causes"."kind" = 'reminder_fire'
                and "message_causes"."reminder_id" is not null
                and "message_causes"."reminder_fire_id" is not null
                and "message_causes"."trigger_id" is null
                and "message_causes"."trigger_fire_id" is null
            ))
);
--> statement-breakpoint
ALTER TABLE "reminder_agent_attention" ALTER COLUMN "receipt_message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_fires" ALTER COLUMN "receipt_message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trigger_fires" ALTER COLUMN "receipt_message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "message_causes" ADD CONSTRAINT "message_causes_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_causes" ADD CONSTRAINT "message_causes_message_fk" FOREIGN KEY ("server_id","message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_causes" ADD CONSTRAINT "message_causes_trigger_fk" FOREIGN KEY ("server_id","trigger_id") REFERENCES "public"."triggers"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_causes" ADD CONSTRAINT "message_causes_trigger_fire_fk" FOREIGN KEY ("server_id","trigger_fire_id") REFERENCES "public"."trigger_fires"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_causes" ADD CONSTRAINT "message_causes_reminder_fk" FOREIGN KEY ("server_id","reminder_id") REFERENCES "public"."reminders"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_causes" ADD CONSTRAINT "message_causes_reminder_fire_fk" FOREIGN KEY ("server_id","reminder_fire_id") REFERENCES "public"."reminder_fires"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_causes_trigger_fire_idx" ON "message_causes" USING btree ("server_id","trigger_fire_id");--> statement-breakpoint
CREATE INDEX "message_causes_reminder_fire_idx" ON "message_causes" USING btree ("server_id","reminder_fire_id");