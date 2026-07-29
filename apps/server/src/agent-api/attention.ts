import { and, eq } from 'drizzle-orm';
import { deleteQueuedOrdinaryWork } from '../agent-delivery/store.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentChannelMutesTable, agentThreadFollowsTable, chatsTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
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
    await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        if (muted) {
            await tx
                .insert(agentChannelMutesTable)
                .values({ agentId: runner.agentId, chatId, serverId: runner.serverId })
                .onConflictDoNothing();
            const threads = await tx
                .select({ id: chatsTable.id })
                .from(chatsTable)
                .where(
                    and(
                        eq(chatsTable.serverId, runner.serverId),
                        eq(chatsTable.parentChatId, chatId),
                        eq(chatsTable.kind, 'thread')
                    )
                );
            await deleteQueuedOrdinaryWork(tx, {
                agentId: runner.agentId,
                chatIds: [chatId, ...threads.map((thread) => thread.id)],
                serverId: runner.serverId,
            });
        } else {
            await tx
                .delete(agentChannelMutesTable)
                .where(
                    and(
                        eq(agentChannelMutesTable.serverId, runner.serverId),
                        eq(agentChannelMutesTable.agentId, runner.agentId),
                        eq(agentChannelMutesTable.chatId, chatId)
                    )
                );
        }
    });
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
    await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        await tx
            .insert(agentThreadFollowsTable)
            .values({
                agentId: runner.agentId,
                followed: false,
                serverId: runner.serverId,
                threadChatId,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                set: { followed: false, updatedAt: new Date() },
                target: [
                    agentThreadFollowsTable.serverId,
                    agentThreadFollowsTable.agentId,
                    agentThreadFollowsTable.threadChatId,
                ],
            });
        await deleteQueuedOrdinaryWork(tx, {
            agentId: runner.agentId,
            chatIds: [threadChatId],
            serverId: runner.serverId,
        });
    });
    return { target, unfollowed: true };
}

export async function followAgentThread(
    db: GrottoDatabase,
    input: { agentId: string; serverId: string; threadChatId: string }
) {
    await db
        .insert(agentThreadFollowsTable)
        .values({ ...input, followed: true, updatedAt: new Date() })
        .onConflictDoUpdate({
            set: { followed: true, updatedAt: new Date() },
            target: [
                agentThreadFollowsTable.serverId,
                agentThreadFollowsTable.agentId,
                agentThreadFollowsTable.threadChatId,
            ],
        });
}
