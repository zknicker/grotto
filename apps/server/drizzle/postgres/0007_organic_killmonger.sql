ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_author_shape";--> statement-breakpoint
DELETE FROM "reminders"
WHERE ("server_id", "anchor_chat_id") IN (
    SELECT thread."server_id", thread."id"
    FROM "chats" AS thread
    JOIN "chat_messages" AS receipt
      ON receipt."server_id" = thread."server_id"
     AND receipt."chat_id" = thread."parent_chat_id"
     AND receipt."id" = thread."anchor_message_id"
    WHERE thread."kind" = 'thread'
      AND receipt."system_author" = 'task'
);--> statement-breakpoint
DELETE FROM "reminders"
WHERE ("server_id", "anchor_message_id") IN (
    SELECT "server_id", "id"
    FROM "chat_messages"
    WHERE "system_author" = 'task'
);--> statement-breakpoint
DELETE FROM "chats"
WHERE "kind" = 'thread'
  AND ("server_id", "anchor_message_id") IN (
      SELECT "server_id", "id"
      FROM "chat_messages"
      WHERE "system_author" = 'task'
  );--> statement-breakpoint
DELETE FROM "chat_messages" WHERE "system_author" = 'task';--> statement-breakpoint
SET CONSTRAINTS ALL IMMEDIATE;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_shape" CHECK ((
                ("chat_messages"."author_user_id" is not null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_agent_id" is not null and "chat_messages"."author_user_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_user_id" is null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" in ('reminder', 'session'))
            ));
