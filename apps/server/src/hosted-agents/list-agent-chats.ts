import type { HostedChat } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import { listHostedChats } from '../chats/list-chats.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { channelAgentParticipantsTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export async function listHostedAgentChats(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { agentId: string; serverId: string }
): Promise<HostedChat[]> {
    const [visibleChats, channelRows] = await Promise.all([
        listHostedChats(db, member, input.serverId),
        db
            .select({ chatId: channelAgentParticipantsTable.chatId })
            .from(channelAgentParticipantsTable)
            .where(
                and(
                    eq(channelAgentParticipantsTable.serverId, input.serverId),
                    eq(channelAgentParticipantsTable.agentId, input.agentId)
                )
            ),
    ]);
    const channelIds = new Set(channelRows.map((row) => row.chatId));
    return visibleChats.filter(
        (chat) => chat.peerAgentId === input.agentId || channelIds.has(chat.id)
    );
}
