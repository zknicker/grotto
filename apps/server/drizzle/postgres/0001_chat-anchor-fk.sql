-- Drizzle cannot express this composite reference in the typed schema without
-- creating a circular chats <-> chat_messages table initializer.
ALTER TABLE "chats" ADD CONSTRAINT "chats_thread_anchor_fk"
FOREIGN KEY ("server_id", "parent_chat_id", "anchor_message_id")
REFERENCES "chat_messages" ("server_id", "chat_id", "id")
ON DELETE NO ACTION ON UPDATE NO ACTION;
