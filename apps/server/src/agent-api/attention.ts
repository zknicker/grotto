import { and, eq } from 'drizzle-orm';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentChannelMutesTable, agentThreadFollowsTable, chatsTable } from '../postgres/schema.ts';
import { AgentTargetError, resolveAgentTarget } from './resolve-target.ts';

export async function changeAgentChannelMute(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    target: string,
    muted: boolean
) {
    const chatId = await resolveAgentTarget(db, runner, target);
    const [channel] = await db
        .select({ kind: chatsTable.kind, name: chatsTable.name })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, runner.serverId),
                eq(chatsTable.id, chatId),
                eq(chatsTable.kind, 'channel')
            )
        )
        .limit(1);
    if (!channel?.name) {
        throw new AgentTargetError('Channel mutes require a joined channel.');
    }
    if (muted) {
        await db
            .insert(agentChannelMutesTable)
            .values({ agentId: runner.agentId, chatId, serverId: runner.serverId })
            .onConflictDoNothing();
    } else {
        await db
            .delete(agentChannelMutesTable)
            .where(
                and(
                    eq(agentChannelMutesTable.serverId, runner.serverId),
                    eq(agentChannelMutesTable.agentId, runner.agentId),
                    eq(agentChannelMutesTable.chatId, chatId)
                )
            );
    }
    return { muted, target: `#${channel.name}` };
}

export async function unfollowAgentThread(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    target: string
) {
    const threadChatId = await resolveAgentTarget(db, runner, target);
    const [thread] = await db
        .select({ kind: chatsTable.kind })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, runner.serverId),
                eq(chatsTable.id, threadChatId),
                eq(chatsTable.kind, 'thread')
            )
        )
        .limit(1);
    if (!thread) {
        throw new AgentTargetError('Thread unfollow requires a joined thread target.');
    }
    await db
        .delete(agentThreadFollowsTable)
        .where(
            and(
                eq(agentThreadFollowsTable.serverId, runner.serverId),
                eq(agentThreadFollowsTable.agentId, runner.agentId),
                eq(agentThreadFollowsTable.threadChatId, threadChatId)
            )
        );
    return { followed: false, target };
}

export async function followAgentThread(
    db: GrottoDatabase,
    input: { agentId: string; serverId: string; threadChatId: string }
) {
    await db.insert(agentThreadFollowsTable).values(input).onConflictDoNothing();
}
