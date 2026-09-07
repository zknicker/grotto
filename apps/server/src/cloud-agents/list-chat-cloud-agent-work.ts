import type { ThreadCloudAgentWork } from '@grotto/api';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { requireChatAccess } from '../chats/chat-access.ts';
import { visibleChats } from '../chats/chat-visibility.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatsTable, cloudAgentWorkTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { readRuns, toCloudAgentWork } from './cloud-agent-shape.ts';

/** Durable work in a conversation and its Threads, including settled outcomes. */
export async function listChatCloudAgentWork(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { serverId: string; chatId: string }
): Promise<ThreadCloudAgentWork[]> {
    await requireChatAccess(db, member, input);
    if (!member) {
        return [];
    }
    const rows = await db
        .select({
            work: cloudAgentWorkTable,
            kind: chatsTable.kind,
            anchor: chatsTable.anchorMessageId,
        })
        .from(cloudAgentWorkTable)
        .innerJoin(
            chatsTable,
            and(
                eq(chatsTable.serverId, cloudAgentWorkTable.serverId),
                eq(chatsTable.id, cloudAgentWorkTable.chatId),
                isNull(chatsTable.deletedAt),
                visibleChats(member.id)
            )
        )
        .where(
            and(
                eq(cloudAgentWorkTable.serverId, input.serverId),
                or(eq(chatsTable.id, input.chatId), eq(chatsTable.parentChatId, input.chatId))
            )
        )
        .orderBy(asc(cloudAgentWorkTable.createdAt), asc(cloudAgentWorkTable.id));
    const runs = await readRuns(
        db,
        input.serverId,
        rows.map(({ work }) => work.id)
    );
    return rows.map(({ work, kind, anchor }) => {
        const anchorMessageId = kind === 'thread' ? anchor : work.messageId;
        if (!anchorMessageId) {
            throw new Error('Cloud Agent work has no Thread anchor.');
        }
        return {
            anchorMessageId,
            work: toCloudAgentWork(work, runs.get(work.id) ?? []),
        };
    });
}
