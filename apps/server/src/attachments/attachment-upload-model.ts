import type { attachmentsTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

export class AttachmentUploadError extends Error {
    constructor(
        message: string,
        readonly code: 'conflict' | 'forbidden' | 'length_mismatch' | 'not_found' | 'size_limit'
    ) {
        super(message);
        this.name = 'AttachmentUploadError';
    }
}

export interface AttachmentUploadInput {
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
    beforeStagedFileClose?(): Promise<void> | void;
}

export function toAttachmentUploadMetadata(attachment: typeof attachmentsTable.$inferSelect) {
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
