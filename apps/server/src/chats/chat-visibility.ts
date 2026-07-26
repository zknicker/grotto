import { type SQL, sql } from 'drizzle-orm';
import { chatsTable } from '../postgres/schema.ts';

/** The canonical DM-pair-or-Channel-participant visibility rule. */
export function visibleHostedChats(userId: string): SQL {
    return sql`(
        (
            ${chatsTable.kind} = 'dm'
            and (
                ${chatsTable.dmMemberOneUserId} = ${userId}
                or ${chatsTable.dmMemberTwoUserId} = ${userId}
            )
        )
        or exists (
            select 1
            from channel_participants participant
            where participant.server_id = ${chatsTable.serverId}
                and participant.chat_id = ${chatsTable.id}
                and participant.user_id = ${userId}
        )
        or (
            ${chatsTable.kind} = 'thread'
            and exists (
                select 1
                from chats parent
                where parent.server_id = ${chatsTable.serverId}
                    and parent.id = ${chatsTable.parentChatId}
                    and (
                        (
                            parent.kind = 'dm'
                            and (
                                parent.dm_member_one_user_id = ${userId}
                                or parent.dm_member_two_user_id = ${userId}
                            )
                        )
                        or exists (
                            select 1
                            from channel_participants parent_participant
                            where parent_participant.server_id = parent.server_id
                                and parent_participant.chat_id = parent.id
                                and parent_participant.user_id = ${userId}
                        )
                    )
            )
        )
    )`;
}
