import { createHash } from 'node:crypto';
import type { HostedAttachmentUploadResult } from '@tavern/api';
import { and, eq, inArray } from 'drizzle-orm';
import { requireChatAccess } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { attachmentsTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import type { AttachmentRoot } from './attachment-root.ts';
import { hostedAttachmentMaxSizeBytes } from './reserve-attachment.ts';

export class AttachmentUploadError extends Error {
    constructor(
        message: string,
        readonly code: 'conflict' | 'forbidden' | 'length_mismatch' | 'not_found' | 'size_limit'
    ) {
        super(message);
        this.name = 'AttachmentUploadError';
    }
}

interface UploadInput {
    attachmentId: string;
    declaredLength: number | null;
    failureInjection?: AttachmentUploadFailureInjection;
    member: GrottoUser | null;
    serverId: string;
    stream: AsyncIterable<Uint8Array>;
}

export interface AttachmentUploadFailureInjection {
    afterFileFinalized?(): Promise<void> | void;
    afterFinalizingCommit?(): Promise<void> | void;
    afterStagingSynced?(): Promise<void> | void;
    beforeReadyCommit?(): Promise<void> | void;
}

export async function uploadHostedAttachment(
    db: GrottoDatabase,
    root: AttachmentRoot,
    input: UploadInput
): Promise<HostedAttachmentUploadResult> {
    const releaseServerWrite = root.beginServerWrite(input.serverId);
    try {
        return await uploadHostedAttachmentOperation(db, root, input);
    } finally {
        releaseServerWrite();
    }
}

async function uploadHostedAttachmentOperation(
    db: GrottoDatabase,
    root: AttachmentRoot,
    input: UploadInput
): Promise<HostedAttachmentUploadResult> {
    const attachment = await findAttachment(db, input.serverId, input.attachmentId);

    if (!attachment) {
        throw new AttachmentUploadError('No attachment was found in that Server.', 'not_found');
    }
    if (!attachment.chatId) {
        throw new AttachmentUploadError('That attachment is not a human upload.', 'forbidden');
    }

    await requireChatAccess(db, input.member, {
        chatId: attachment.chatId,
        serverId: input.serverId,
    });

    if (!input.member || attachment.uploaderUserId !== input.member.id) {
        throw new AttachmentUploadError(
            'Only the attachment uploader can upload its bytes.',
            'forbidden'
        );
    }

    if (attachment.state === 'ready') {
        const incoming = await digestStream(input.stream);
        if (input.declaredLength !== null && input.declaredLength !== incoming.sizeBytes) {
            throw new AttachmentUploadError(
                'Content-Length did not match the streamed attachment bytes.',
                'length_mismatch'
            );
        }
        if (attachment.byteSize !== incoming.sizeBytes || attachment.sha256 !== incoming.sha256) {
            throw new AttachmentUploadError(
                'That attachment id is already ready with different bytes.',
                'conflict'
            );
        }
        return { attachment: toMetadata(attachment), idempotent: true };
    }

    const attemptId = createOpaqueId('upl');
    const [claimed] = await db
        .update(attachmentsTable)
        .set({
            attemptId,
            byteSize: null,
            failedAt: null,
            failureCode: null,
            readyAt: null,
            sha256: null,
            stagingKey: attemptId,
            state: 'uploading',
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(attachmentsTable.serverId, input.serverId),
                eq(attachmentsTable.id, input.attachmentId),
                inArray(attachmentsTable.state, ['pending', 'failed'])
            )
        )
        .returning();

    if (!claimed) {
        throw new AttachmentUploadError(
            'That attachment upload is already in progress.',
            'conflict'
        );
    }

    let stagedFile: Awaited<ReturnType<AttachmentRoot['createStagingFile']>> | null = null;
    let finalizing = false;

    try {
        stagedFile = await root.createStagingFile(input.serverId, attemptId);
        const { sha256, sizeBytes } = await streamToFile(stagedFile, input.stream);
        await stagedFile.sync();
        await stagedFile.close();
        stagedFile = null;
        await input.failureInjection?.afterStagingSynced?.();

        if (input.declaredLength !== null && input.declaredLength !== sizeBytes) {
            throw new AttachmentUploadError(
                'Content-Length did not match the streamed attachment bytes.',
                'length_mismatch'
            );
        }

        const [markedFinalizing] = await db
            .update(attachmentsTable)
            .set({ byteSize: sizeBytes, sha256, state: 'finalizing', updatedAt: new Date() })
            .where(currentAttempt(input, attemptId, 'uploading'))
            .returning({ id: attachmentsTable.id });

        if (!markedFinalizing) {
            throw new AttachmentUploadError('The attachment upload claim was lost.', 'conflict');
        }
        finalizing = true;
        await input.failureInjection?.afterFinalizingCommit?.();

        await root.finalize(input.serverId, input.attachmentId, attemptId);
        await input.failureInjection?.afterFileFinalized?.();
        await input.failureInjection?.beforeReadyCommit?.();

        const [ready] = await db
            .update(attachmentsTable)
            .set({ readyAt: new Date(), state: 'ready', updatedAt: new Date() })
            .where(currentAttempt(input, attemptId, 'finalizing'))
            .returning();

        if (!ready) {
            throw new Error('The finalized attachment row could not be marked ready.');
        }

        return { attachment: toMetadata(ready), idempotent: false };
    } catch (cause) {
        await stagedFile?.close().catch(() => undefined);

        if (!finalizing) {
            await root.discardStagingFile(input.serverId, attemptId).catch(() => undefined);
            await markFailed(db, input, attemptId, failureCode(cause));
        }

        throw cause;
    }
}

async function streamToFile(
    file: Awaited<ReturnType<AttachmentRoot['createStagingFile']>>,
    stream: AsyncIterable<Uint8Array>
) {
    return await digestStream(stream, async (chunk) => {
        await file.write(chunk);
    });
}

async function digestStream(
    stream: AsyncIterable<Uint8Array>,
    onChunk?: (chunk: Buffer) => Promise<void>
) {
    const hash = createHash('sha256');
    let sizeBytes = 0;

    for await (const rawChunk of stream) {
        const chunk = Buffer.from(rawChunk);
        sizeBytes += chunk.byteLength;
        if (sizeBytes > hostedAttachmentMaxSizeBytes) {
            throw new AttachmentUploadError('Attachment exceeds the 50 MiB limit.', 'size_limit');
        }
        hash.update(chunk);
        await onChunk?.(chunk);
    }

    return { sha256: hash.digest('hex'), sizeBytes };
}

async function findAttachment(db: GrottoDatabase, serverId: string, attachmentId: string) {
    const [attachment] = await db
        .select()
        .from(attachmentsTable)
        .where(and(eq(attachmentsTable.serverId, serverId), eq(attachmentsTable.id, attachmentId)))
        .limit(1);
    return attachment;
}

function currentAttempt(input: UploadInput, attemptId: string, state: 'finalizing' | 'uploading') {
    return and(
        eq(attachmentsTable.serverId, input.serverId),
        eq(attachmentsTable.id, input.attachmentId),
        eq(attachmentsTable.attemptId, attemptId),
        eq(attachmentsTable.state, state)
    );
}

async function markFailed(
    db: GrottoDatabase,
    input: UploadInput,
    attemptId: string,
    failure: string
) {
    await db
        .update(attachmentsTable)
        .set({ failedAt: new Date(), failureCode: failure, state: 'failed', updatedAt: new Date() })
        .where(currentAttempt(input, attemptId, 'uploading'));
}

function failureCode(cause: unknown) {
    return cause instanceof AttachmentUploadError ? cause.code : 'storage';
}

function toMetadata(attachment: typeof attachmentsTable.$inferSelect) {
    if (attachment.byteSize === null) {
        throw new Error('Ready attachment metadata is incomplete.');
    }
    return {
        filename: attachment.filename,
        id: attachment.id,
        mediaType: attachment.mediaType,
        sizeBytes: attachment.byteSize,
    };
}
