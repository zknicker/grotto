ALTER TABLE "chats" DROP CONSTRAINT "chats_shape";--> statement-breakpoint
UPDATE "chats" SET
    "dm_member_one_user_id" = "dm_member_two_user_id",
    "dm_member_one_stint" = "dm_member_two_stint",
    "dm_member_two_user_id" = "dm_member_one_user_id",
    "dm_member_two_stint" = "dm_member_one_stint"
WHERE "kind" = 'dm'
    AND "dm_member_one_user_id" IS NOT NULL
    AND "dm_member_two_user_id" IS NOT NULL
    AND "dm_member_one_user_id" COLLATE "C" > "dm_member_two_user_id" COLLATE "C";--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_shape" CHECK ((
                (
                    "chats"."kind" = 'channel'
                    and "chats"."name" is not null
                    and "chats"."dm_agent_id" is null
                    and "chats"."dm_member_one_stint" is null
                    and "chats"."dm_member_one_user_id" is null
                    and "chats"."dm_member_two_stint" is null
                    and "chats"."dm_member_two_user_id" is null
                    and "chats"."parent_chat_id" is null
                    and "chats"."parent_chat_kind" is null
                    and "chats"."anchor_message_id" is null
                    and (not "chats"."is_all" or "chats"."name" = 'all')
                )
                or (
                    "chats"."kind" = 'dm'
                    and "chats"."name" is null
                    and "chats"."is_all" = false
                    and "chats"."dm_member_one_stint" is not null
                    and "chats"."dm_member_one_user_id" is not null
                    and "chats"."parent_chat_id" is null
                    and "chats"."parent_chat_kind" is null
                    and "chats"."anchor_message_id" is null
                    and (
                        (
                            "chats"."dm_agent_id" is null
                            and "chats"."dm_member_two_stint" is not null
                            and "chats"."dm_member_two_user_id" is not null
                            and "chats"."dm_member_one_user_id" collate "C" < "chats"."dm_member_two_user_id" collate "C"
                        )
                        or (
                            "chats"."dm_agent_id" is not null
                            and "chats"."dm_member_two_stint" is null
                            and "chats"."dm_member_two_user_id" is null
                        )
                    )
                )
                or (
                    "chats"."kind" = 'thread'
                    and "chats"."name" is null
                    and "chats"."is_all" = false
                    and "chats"."dm_agent_id" is null
                    and "chats"."dm_member_one_stint" is null
                    and "chats"."dm_member_one_user_id" is null
                    and "chats"."dm_member_two_stint" is null
                    and "chats"."dm_member_two_user_id" is null
                    and "chats"."parent_chat_id" is not null
                    and "chats"."parent_chat_kind" in ('channel', 'dm')
                    and "chats"."anchor_message_id" is not null
                )
            ));