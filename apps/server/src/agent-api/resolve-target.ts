import { and, eq, isNull, sql } from 'drizzle-orm';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { HausDatabase } from '../postgres/connection.ts';
import {
    channelAgentParticipantsTable,
    chatsTable,
    serverMembershipsTable,
} from '../postgres/schema.ts';

/**
 * Resolves the Agent CLI's product target under the runner's Server and Agent
 * authority. The launch chat is context, not a routing shortcut.
 */
export async function resolveAgentTarget(
    db: HausDatabase,
    runner: ResolvedRunner,
    target: string
): Promise<string> {
    if (target.startsWith('#')) {
        const [channelName, threadAnchor, ...extra] = target.slice(1).split(':');
        if (!channelName || extra.length > 0) {
            throw new AgentTargetError();
        }
        const [channel] = await db
            .select({ id: chatsTable.id })
            .from(chatsTable)
            .innerJoin(
                channelAgentParticipantsTable,
                and(
                    eq(channelAgentParticipantsTable.serverId, chatsTable.serverId),
                    eq(channelAgentParticipantsTable.chatId, chatsTable.id),
                    eq(channelAgentParticipantsTable.agentId, runner.agentId)
                )
            )
            .where(
                and(
                    eq(chatsTable.serverId, runner.serverId),
                    eq(chatsTable.kind, 'channel'),
                    eq(chatsTable.name, channelName)
                )
            )
            .limit(1);
        if (channel) {
            if (!threadAnchor) {
                return channel.id;
            }
            return await resolveAgentThreadTarget(db, runner, channel.id, threadAnchor);
        }
        throw new AgentTargetError();
    }

    if (target.startsWith('dm:@')) {
        const [peer, threadAnchor, ...extra] = target.slice('dm:@'.length).split(':');
        if (!peer || extra.length > 0) {
            throw new AgentTargetError();
        }
        const chats = await db
            .select({ id: chatsTable.id })
            .from(chatsTable)
            .innerJoin(
                serverMembershipsTable,
                and(
                    eq(serverMembershipsTable.serverId, chatsTable.serverId),
                    eq(serverMembershipsTable.userId, chatsTable.dmMemberOneUserId)
                )
            )
            .where(
                and(
                    eq(chatsTable.serverId, runner.serverId),
                    eq(chatsTable.kind, 'dm'),
                    eq(chatsTable.dmAgentId, runner.agentId),
                    sql`lower(${serverMembershipsTable.handle}) = lower(${peer})`,
                    isNull(serverMembershipsTable.revokedAt)
                )
            )
            .limit(2);
        if (chats.length === 1) {
            const chat = chats[0];
            if (!threadAnchor) {
                return chat.id;
            }
            return await resolveAgentThreadTarget(db, runner, chat.id, threadAnchor);
        }
    }

    throw new AgentTargetError();
}

async function resolveAgentThreadTarget(
    db: HausDatabase,
    runner: ResolvedRunner,
    parentChatId: string,
    threadAnchor: string
) {
    const threads = await db
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, runner.serverId),
                eq(chatsTable.kind, 'thread'),
                eq(chatsTable.parentChatId, parentChatId),
                threadAnchor.startsWith('msg_')
                    ? eq(chatsTable.anchorMessageId, threadAnchor)
                    : sql`${chatsTable.anchorMessageId}
                        ilike ${`msg_${escapeLike(threadAnchor)}%`} escape '\\'`
            )
        )
        .limit(2);
    if (threads.length !== 1) {
        throw new AgentTargetError();
    }
    return threads[0].id;
}

export class AgentTargetError extends Error {
    constructor(message = 'That target does not exist or this Agent has not joined it.') {
        super(message);
        this.name = 'AgentTargetError';
    }
}

export function escapeLike(value: string) {
    return value.replaceAll(/[\\%_]/gu, '\\$&');
}
