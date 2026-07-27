import type { HostedChatMessage } from '@tavern/api';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { chatMessagesTable } from '../postgres/schema.ts';
import { listHostedMessageTaskMap } from '../tasks/task-shape.ts';
import { listHostedThreadSummaries } from '../threads/list-thread-summaries.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireChatAccess } from './chat-access.ts';
import { toHostedChatMessage } from './message-shape.ts';

export async function listHostedChatMessages(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: {
        beforeSequence?: number;
        chatId: string;
        limit: number;
        serverId: string;
    }
): Promise<{
    messages: HostedChatMessage[];
    nextBeforeSequence: number | null;
    threads: Awaited<ReturnType<typeof listHostedThreadSummaries>>;
}> {
    await requireChatAccess(db, member, input);

    const predicates = [
        eq(chatMessagesTable.serverId, input.serverId),
        eq(chatMessagesTable.chatId, input.chatId),
    ];

    if (input.beforeSequence !== undefined) {
        predicates.push(lt(chatMessagesTable.sequence, input.beforeSequence));
    }

    const newestFirst = await db
        .select()
        .from(chatMessagesTable)
        .where(and(...predicates))
        .orderBy(desc(chatMessagesTable.sequence))
        .limit(input.limit + 1);
    const hasOlderMessages = newestFirst.length > input.limit;
    const messageRows = newestFirst.slice(0, input.limit).reverse();
    const taskByMessageId = await listHostedMessageTaskMap(
        db,
        input.serverId,
        messageRows.map((message) => message.id)
    );
    const messages = messageRows.map((message) => ({
        ...toHostedChatMessage(message),
        task: taskByMessageId.get(message.id) ?? null,
    }));

    return {
        messages,
        nextBeforeSequence: hasOlderMessages ? (messages[0]?.sequence ?? null) : null,
        threads: await listHostedThreadSummaries(db, member, {
            anchorMessageIds: messages.map((message) => message.id),
            parentChatId: input.chatId,
            serverId: input.serverId,
        }),
    };
}
