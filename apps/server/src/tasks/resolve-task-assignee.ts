import { and, eq, isNull } from 'drizzle-orm';
import { findChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import {
    agentsTable,
    channelAgentParticipantsTable,
    chatsTable,
    serverMembershipsTable,
} from '../postgres/schema.ts';

export class InvalidTaskAssigneeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidTaskAssigneeError';
    }
}

export interface ResolvedTaskAssignee {
    agentId: null | string;
    /** The assignee's handle, for the assignment receipt. */
    handle: null | string;
    userId: null | string;
}

/**
 * Validates who a task may be handed to. An Agent must be active and already a
 * participant of the parent Chat — it has to be able to read the conversation
 * to do the work — and a human must be an active member with Chat access.
 */
export async function resolveTaskAssignee(
    db: GrottoDatabase,
    input: {
        assignee: { agentId: string; kind: 'agent' } | { kind: 'human'; userId: string } | null;
        chatId: string;
        serverId: string;
    }
): Promise<ResolvedTaskAssignee> {
    if (!input.assignee) {
        return { agentId: null, handle: null, userId: null };
    }

    if (input.assignee.kind === 'agent') {
        const agentId = input.assignee.agentId;
        const [agent] = await db
            .select({ handle: agentsTable.handle })
            .from(agentsTable)
            .where(
                and(
                    eq(agentsTable.serverId, input.serverId),
                    eq(agentsTable.id, agentId),
                    isNull(agentsTable.retiredAt)
                )
            )
            .limit(1);
        if (!agent) {
            throw new InvalidTaskAssigneeError(
                'The assigned Agent must be an active Agent on this Server.'
            );
        }
        const participates = await agentParticipatesInChat(db, {
            agentId,
            chatId: input.chatId,
            serverId: input.serverId,
        });
        if (!participates) {
            throw new InvalidTaskAssigneeError(
                'The assigned Agent must belong to the parent Chat.'
            );
        }
        return { agentId, handle: agent.handle, userId: null };
    }

    const userId = input.assignee.userId;
    const [active] = await db
        .select({ userId: serverMembershipsTable.userId })
        .from(serverMembershipsTable)
        .where(
            and(
                eq(serverMembershipsTable.serverId, input.serverId),
                eq(serverMembershipsTable.userId, userId),
                isNull(serverMembershipsTable.revokedAt)
            )
        )
        .limit(1);
    const access = active
        ? await findChatAccess(db, active.userId, {
              chatId: input.chatId,
              serverId: input.serverId,
          })
        : null;
    if (!(active && access)) {
        throw new InvalidTaskAssigneeError(
            'The assignee must be an active Server member with access to the parent Chat.'
        );
    }
    return { agentId: null, handle: null, userId };
}

async function agentParticipatesInChat(
    db: GrottoDatabase,
    input: { agentId: string; chatId: string; serverId: string }
): Promise<boolean> {
    const [chat] = await db
        .select({ dmAgentId: chatsTable.dmAgentId, kind: chatsTable.kind })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
        .limit(1);
    if (!chat) {
        return false;
    }
    if (chat.kind === 'dm') {
        return chat.dmAgentId === input.agentId;
    }

    const [participant] = await db
        .select({ agentId: channelAgentParticipantsTable.agentId })
        .from(channelAgentParticipantsTable)
        .where(
            and(
                eq(channelAgentParticipantsTable.serverId, input.serverId),
                eq(channelAgentParticipantsTable.chatId, input.chatId),
                eq(channelAgentParticipantsTable.agentId, input.agentId)
            )
        )
        .limit(1);
    return Boolean(participant);
}
