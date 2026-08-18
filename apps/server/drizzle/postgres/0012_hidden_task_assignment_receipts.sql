ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_author_shape";--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_shape" CHECK ((
                ("chat_messages"."author_user_id" is not null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_agent_id" is not null and "chat_messages"."author_user_id" is null and "chat_messages"."system_author" is null)
                or
                ("chat_messages"."author_user_id" is null and "chat_messages"."author_agent_id" is null and "chat_messages"."system_author" in ('reminder', 'session', 'task'))
            ));
