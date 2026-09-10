-- `ON DELETE SET NULL` on a composite foreign key nulls every referencing
-- column, so deleting an Agent's creation message tried to null the not-null
-- `agents.server_id` and failed instead of detaching the link. Naming the
-- column limits the action to the link itself, which is what the reference has
-- always meant.
ALTER TABLE "agents" DROP CONSTRAINT "agents_creation_message_fk";
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_creation_message_fk" FOREIGN KEY ("server_id","creation_message_id") REFERENCES "public"."chat_messages"("server_id","id") ON DELETE set null (creation_message_id) ON UPDATE no action;
