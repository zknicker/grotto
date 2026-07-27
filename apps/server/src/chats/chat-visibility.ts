import { type SQL, sql } from 'drizzle-orm';
import { chatsTable } from '../postgres/schema.ts';

/** The canonical DM-pair-or-Channel-participant visibility rule. */
export function visibleHostedChats(userId: string): SQL {
    return sql`(
        (
            ${chatsTable.kind} = 'dm'
            and (
                (
                    ${chatsTable.dmMemberOneUserId} = ${userId}
                    and exists (
                        select 1 from server_memberships membership
                        where membership.server_id = ${chatsTable.serverId}
                            and membership.user_id = ${userId}
                            and membership.stint = ${chatsTable.dmMemberOneStint}
                    )
                )
                or (
                    ${chatsTable.dmMemberTwoUserId} = ${userId}
                    and exists (
                        select 1 from server_memberships membership
                        where membership.server_id = ${chatsTable.serverId}
                            and membership.user_id = ${userId}
                            and membership.stint = ${chatsTable.dmMemberTwoStint}
                    )
                )
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
                                (
                                    parent.dm_member_one_user_id = ${userId}
                                    and exists (
                                        select 1 from server_memberships membership
                                        where membership.server_id = parent.server_id
                                            and membership.user_id = ${userId}
                                            and membership.stint = parent.dm_member_one_stint
                                    )
                                )
                                or (
                                    parent.dm_member_two_user_id = ${userId}
                                    and exists (
                                        select 1 from server_memberships membership
                                        where membership.server_id = parent.server_id
                                            and membership.user_id = ${userId}
                                            and membership.stint = parent.dm_member_two_stint
                                    )
                                )
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
