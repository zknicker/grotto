ALTER TABLE "agent_inbox_pierces" RENAME TO "agent_inbox_exact_visibility";--> statement-breakpoint
ALTER TABLE "agent_inbox_cursors" DROP CONSTRAINT "agent_inbox_cursors_nonnegative";--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" DROP CONSTRAINT "agent_inbox_pierces_generation";--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" DROP CONSTRAINT "agent_inbox_pierces_agent_fk";
--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" DROP CONSTRAINT "agent_inbox_pierces_chat_fk";
--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" DROP CONSTRAINT "agent_inbox_pierces_message_fk";
--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" DROP CONSTRAINT "agent_inbox_pierces_server_id_agent_id_session_generation_chat_id_message_id_pk";--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" ADD CONSTRAINT "agent_inbox_exact_visibility_server_id_agent_id_session_generation_chat_id_message_id_pk" PRIMARY KEY("server_id","agent_id","session_generation","chat_id","message_id");--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" ADD COLUMN "served_run_id" text;--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" ADD COLUMN "settled_run_id" text;--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" ADD CONSTRAINT "agent_inbox_exact_visibility_agent_fk" FOREIGN KEY ("server_id","agent_id") REFERENCES "public"."agents"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" ADD CONSTRAINT "agent_inbox_exact_visibility_chat_fk" FOREIGN KEY ("server_id","chat_id") REFERENCES "public"."chats"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" ADD CONSTRAINT "agent_inbox_exact_visibility_message_fk" FOREIGN KEY ("server_id","message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_work" DROP COLUMN "pierced";--> statement-breakpoint
ALTER TABLE "agent_inbox_cursors" DROP COLUMN "delivered_up_to_sequence";--> statement-breakpoint
ALTER TABLE "agent_inbox_cursors" DROP COLUMN "served_up_to_sequence";--> statement-breakpoint
ALTER TABLE "agent_inbox_cursors" ADD CONSTRAINT "agent_inbox_cursors_nonnegative" CHECK ("agent_inbox_cursors"."seen_up_to_sequence" >= 0
                and "agent_inbox_cursors"."session_generation" > 0);--> statement-breakpoint
ALTER TABLE "agent_inbox_exact_visibility" ADD CONSTRAINT "agent_inbox_exact_visibility_generation" CHECK ("agent_inbox_exact_visibility"."session_generation" > 0);