import type { HostedDurableEvent } from '@tavern/api';
import { and, eq, sql } from 'drizzle-orm';
import { allocateHostedEventCursor } from '../chats/allocate-event-cursor.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { chatEventsTable, chatMessagesTable, chatsTable } from '../postgres/schema.ts';

type SessionRotationReason = 'configuration' | 'full' | 'recovery' | 'session';

/**
 * Lands one canonical new-session receipt in every existing human↔Agent DM.
 * Hosted Servers can have more than one human seat for an Agent, so the
 * Agent-scoped lifecycle fact belongs in each built-in DM rather than an
 * arbitrary channel.
 */
export async function recordHostedSessionRotationReceipts(
    db: GrottoDatabase,
    input: {
        agentId: string;
        generation: number;
        reason: SessionRotationReason;
        serverId: string;
    }
): Promise<HostedDurableEvent[]> {
    const dms = await db
        .select({ chatId: chatsTable.id })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, input.serverId),
                eq(chatsTable.kind, 'dm'),
                eq(chatsTable.dmAgentId, input.agentId)
            )
        );
    const events: HostedDurableEvent[] = [];
    const now = new Date();
    for (const dm of dms) {
        const [chat] = await db
            .update(chatsTable)
            .set({
                lastActivityAt: now,
                lastMessageSequence: sql`${chatsTable.lastMessageSequence} + 1`,
            })
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, dm.chatId)))
            .returning({ sequence: chatsTable.lastMessageSequence });
        if (!chat) {
            continue;
        }
        const messageId = createOpaqueId('msg');
        await db.insert(chatMessagesTable).values({
            chatId: dm.chatId,
            content: rotationText(input.reason),
            createdAt: now,
            id: messageId,
            nonce: `session:${input.agentId}:${input.generation}`,
            sequence: chat.sequence,
            serverId: input.serverId,
            systemAuthor: 'session',
        });
        const cursor = await allocateHostedEventCursor(db, input.serverId);
        const eventId = createOpaqueId('evt');
        await db.insert(chatEventsTable).values({
            chatId: dm.chatId,
            createdAt: now,
            cursor,
            id: eventId,
            messageId,
            sequence: chat.sequence,
            serverId: input.serverId,
            type: 'message.created',
        });
        events.push({
            chatId: dm.chatId,
            createdAt: now.toISOString(),
            cursor: cursor.toString(),
            id: eventId,
            messageId,
            parentChatId: null,
            sequence: chat.sequence,
            serverId: input.serverId,
            type: 'message.created',
        });
    }
    return events;
}

function rotationText(reason: SessionRotationReason): string {
    if (reason === 'configuration') {
        return 'Started a fresh session with the newly selected runtime and model. The workspace and MEMORY.md are intact.';
    }
    if (reason === 'full') {
        return 'Started completely fresh: new session and a factory-fresh local workspace. Earlier files and MEMORY.md are gone.';
    }
    if (reason === 'recovery') {
        return 'Started a fresh session because the previous runtime context could not be resumed. The workspace and MEMORY.md are intact.';
    }
    return 'Started a fresh session. New messages start with fresh context; the workspace and MEMORY.md are intact.';
}
