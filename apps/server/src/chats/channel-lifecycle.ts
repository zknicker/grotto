import type {
    ChannelDeleteReceipt,
    ChannelLifecycleReceipt,
    ServerDurableEvent,
} from '@grotto/api';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { AttachmentRoot } from '../attachments/attachment-root.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentPendingWorkTable, chatsTable } from '../postgres/schema.ts';
import { requireServerMembership } from '../servers/server-access.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { purgeDeletedChannel } from './channel-deletion.ts';
import { insertLifecycleEvent } from './lifecycle-events.ts';

export { purgeDeletedChannels } from './channel-deletion.ts';

export class ChannelLifecycleDeniedError extends Error {
    constructor(message = 'Only a Server Owner or Admin can manage channel lifecycle.') {
        super(message);
        this.name = 'ChannelLifecycleDeniedError';
    }
}

export class ChannelLifecycleConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChannelLifecycleConflictError';
    }
}

interface LifecycleResult<Receipt> {
    event: ServerDurableEvent | null;
    receipt: Receipt;
}

export async function archiveChannel(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { chatId: string; serverId: string }
): Promise<LifecycleResult<ChannelLifecycleReceipt>> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await requireOperator(tx, member, input.serverId);
        const channel = await requireRegularChannel(tx, input);
        if (channel.archivedAt) {
            return {
                event: null,
                receipt: {
                    archivedAt: channel.archivedAt.toISOString(),
                    chatId: channel.id,
                    serverId: input.serverId,
                },
            };
        }

        const archivedAt = new Date();
        await tx
            .update(chatsTable)
            .set({ archivedAt, archivedByUserId: member?.id ?? null })
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)));
        await discardQueuedChannelWork(tx, input);
        const event = await insertLifecycleEvent(tx, input, 'archived', archivedAt);
        return {
            event,
            receipt: {
                archivedAt: archivedAt.toISOString(),
                chatId: channel.id,
                serverId: input.serverId,
            },
        };
    });
}

export async function unarchiveChannel(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { chatId: string; serverId: string }
): Promise<LifecycleResult<ChannelLifecycleReceipt>> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await requireOperator(tx, member, input.serverId);
        const channel = await requireRegularChannel(tx, input);
        if (!channel.archivedAt) {
            return {
                event: null,
                receipt: { archivedAt: null, chatId: channel.id, serverId: input.serverId },
            };
        }

        const changedAt = new Date();
        await tx
            .update(chatsTable)
            .set({ archivedAt: null, archivedByUserId: null })
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)));
        const event = await insertLifecycleEvent(tx, input, 'unarchived', changedAt);
        return {
            event,
            receipt: { archivedAt: null, chatId: channel.id, serverId: input.serverId },
        };
    });
}

export async function deleteChannel(
    db: GrottoDatabase,
    attachmentRoot: AttachmentRoot,
    member: GrottoUser | null,
    input: { chatId: string; confirmation: string; serverId: string }
): Promise<LifecycleResult<ChannelDeleteReceipt>> {
    const event = await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await requireOperator(tx, member, input.serverId);
        const channel = await requireRegularChannel(tx, input);
        if (input.confirmation !== channel.name) {
            throw new ChannelLifecycleDeniedError('Type the channel name exactly to delete it.');
        }
        if (channel.deletedAt) {
            return null;
        }

        const deletedAt = new Date();
        await tx
            .update(chatsTable)
            .set({ deletedAt, deletedByUserId: member?.id ?? null })
            .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)));
        await discardQueuedChannelWork(tx, input);
        return await insertLifecycleEvent(tx, input, 'deleted', deletedAt);
    });

    await purgeDeletedChannel(db, attachmentRoot, input);
    return { event, receipt: { chatId: input.chatId, serverId: input.serverId } };
}

async function requireOperator(db: GrottoDatabase, member: GrottoUser | null, serverId: string) {
    const server = await requireServerMembership(db, member, serverId);
    if (!member || (server.role !== 'owner' && server.role !== 'admin')) {
        throw new ChannelLifecycleDeniedError();
    }
}

async function requireRegularChannel(
    db: GrottoDatabase,
    input: { chatId: string; serverId: string }
) {
    const [channel] = await db
        .select({
            archivedAt: chatsTable.archivedAt,
            deletedAt: chatsTable.deletedAt,
            id: chatsTable.id,
            isAll: chatsTable.isAll,
            kind: chatsTable.kind,
            name: chatsTable.name,
        })
        .from(chatsTable)
        .where(and(eq(chatsTable.serverId, input.serverId), eq(chatsTable.id, input.chatId)))
        .for('update');
    if (!channel || channel.kind !== 'channel') {
        throw new ChannelLifecycleConflictError('Only a regular channel can use this action.');
    }
    if (channel.isAll) {
        throw new ChannelLifecycleConflictError('#all cannot be archived or deleted.');
    }
    if (!channel.name) {
        throw new Error('A regular channel must have a name.');
    }
    return { ...channel, name: channel.name };
}

async function discardQueuedChannelWork(
    db: GrottoDatabase,
    input: { chatId: string; serverId: string }
) {
    const chats = await db
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .where(
            and(
                eq(chatsTable.serverId, input.serverId),
                or(eq(chatsTable.id, input.chatId), eq(chatsTable.parentChatId, input.chatId))
            )
        );
    await db.delete(agentPendingWorkTable).where(
        and(
            eq(agentPendingWorkTable.serverId, input.serverId),
            inArray(
                agentPendingWorkTable.chatId,
                chats.map(({ id }) => id)
            ),
            isNull(agentPendingWorkTable.runId),
            eq(agentPendingWorkTable.state, 'queued')
        )
    );
}
