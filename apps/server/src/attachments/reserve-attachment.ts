import type { HostedAttachmentReservation, HostedAttachmentReserveInput } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import { requireChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { attachmentsTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export const hostedAttachmentMaxSizeBytes = 50 * 1024 * 1024;

export class AttachmentNonceConflictError extends Error {
    constructor() {
        super('That attachment nonce already belongs to a different upload.');
        this.name = 'AttachmentNonceConflictError';
    }
}

export async function reserveHostedAttachment(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: HostedAttachmentReserveInput
): Promise<HostedAttachmentReservation> {
    await requireChatAccess(db, member, input);

    if (!member) {
        throw new Error('An attachment uploader is required.');
    }

    const [created] = await db
        .insert(attachmentsTable)
        .values({
            chatId: input.chatId,
            filename: input.filename,
            id: createOpaqueId('att'),
            mediaType: input.mediaType,
            serverId: input.serverId,
            state: 'pending',
            uploadNonce: input.nonce,
            uploaderUserId: member.id,
        })
        .onConflictDoNothing({
            target: [
                attachmentsTable.serverId,
                attachmentsTable.uploaderUserId,
                attachmentsTable.uploadNonce,
            ],
        })
        .returning({ id: attachmentsTable.id, state: attachmentsTable.state });

    if (created) {
        return {
            attachmentId: created.id,
            idempotent: false,
            maxSizeBytes: hostedAttachmentMaxSizeBytes,
            state: created.state,
        };
    }

    const [existing] = await db
        .select()
        .from(attachmentsTable)
        .where(
            and(
                eq(attachmentsTable.serverId, input.serverId),
                eq(attachmentsTable.uploaderUserId, member.id),
                eq(attachmentsTable.uploadNonce, input.nonce)
            )
        )
        .limit(1);

    if (
        !existing ||
        existing.chatId !== input.chatId ||
        existing.filename !== input.filename ||
        existing.mediaType !== input.mediaType
    ) {
        throw new AttachmentNonceConflictError();
    }

    return {
        attachmentId: existing.id,
        idempotent: true,
        maxSizeBytes: hostedAttachmentMaxSizeBytes,
        state: existing.state,
    };
}
