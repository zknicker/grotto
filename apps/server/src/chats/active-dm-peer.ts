import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable, chatsTable } from '../postgres/schema.ts';

export class RetiredAgentDmSendError extends Error {
    constructor() {
        super(
            'This Agent is retired. You can read this conversation, but you can’t send new messages.'
        );
        this.name = 'RetiredAgentDmSendError';
    }
}

export async function requireActiveDmPeer(
    db: GrottoDatabase,
    chat: {
        dmAgentId: string | null;
        kind: 'channel' | 'dm' | 'thread';
        parentChatId: string | null;
        serverId: string;
    }
) {
    let agentId = chat.kind === 'dm' ? chat.dmAgentId : null;
    if (chat.kind === 'thread' && chat.parentChatId) {
        const [parent] = await db
            .select({ dmAgentId: chatsTable.dmAgentId })
            .from(chatsTable)
            .where(
                and(eq(chatsTable.serverId, chat.serverId), eq(chatsTable.id, chat.parentChatId))
            )
            .limit(1);
        agentId = parent?.dmAgentId ?? null;
    }
    if (!agentId) {
        return;
    }

    const [agent] = await db
        .select({ retiredAt: agentsTable.retiredAt })
        .from(agentsTable)
        .where(and(eq(agentsTable.serverId, chat.serverId), eq(agentsTable.id, agentId)))
        .limit(1);
    if (!agent || agent.retiredAt) {
        throw new RetiredAgentDmSendError();
    }
}
