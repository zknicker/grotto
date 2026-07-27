import { expect, test } from 'bun:test';
import {
    hostedAttachmentInventorySchema,
    hostedAttachmentMetadataSchema,
    hostedAttachmentReserveInputSchema,
    hostedAttachmentUploadResultSchema,
} from './hosted-attachments.ts';

test('hosted attachment reservations contain client intent but no storage authority', () => {
    expect(
        hostedAttachmentReserveInputSchema.parse({
            chatId: 'cht_all',
            filename: 'quarterly report.pdf',
            mediaType: 'application/pdf',
            nonce: 'upload-1',
            serverId: 'srv_main',
        })
    ).toEqual({
        chatId: 'cht_all',
        filename: 'quarterly report.pdf',
        mediaType: 'application/pdf',
        nonce: 'upload-1',
        serverId: 'srv_main',
    });

    expect(() =>
        hostedAttachmentReserveInputSchema.parse({
            chatId: 'cht_all',
            filename: 'report.pdf',
            mediaType: 'application/pdf',
            nonce: 'upload-1',
            serverId: 'srv_main',
            storagePath: '/tmp/owned-by-client',
            uploaderUserId: 'usr_intruder',
        })
    ).toThrow();
});

test('hosted attachment metadata never includes bytes, hashes, or storage paths', () => {
    const metadata = hostedAttachmentMetadataSchema.parse({
        filename: 'empty.txt',
        id: 'att_one',
        mediaType: 'text/plain',
        sizeBytes: 0,
    });

    expect(metadata).toEqual({
        filename: 'empty.txt',
        id: 'att_one',
        mediaType: 'text/plain',
        sizeBytes: 0,
    });
    expect(() =>
        hostedAttachmentMetadataSchema.parse({
            ...metadata,
            dataBase64: '',
            sha256: 'secret',
            storagePath: '/var/db/grotto/attachments/object',
        })
    ).toThrow();
});

test('streamed upload results distinguish first completion from response-loss retries', () => {
    expect(
        hostedAttachmentUploadResultSchema.parse({
            attachment: {
                filename: 'empty.txt',
                id: 'att_one',
                mediaType: 'text/plain',
                sizeBytes: 0,
            },
            idempotent: true,
        })
    ).toMatchObject({ idempotent: true });
});

test('attachment inventories expose exact relative keys but never a storage root', () => {
    const objectKey = `servers/${'a'.repeat(64)}/objects/${'b'.repeat(64)}`;
    expect(
        hostedAttachmentInventorySchema.parse({
            attachments: [
                {
                    attachmentId: 'att_one',
                    expectedObjectKey: objectKey,
                    expectedStagingKey: null,
                    messageId: 'msg_one',
                    state: 'ready',
                },
            ],
            objectKeys: [objectKey],
            serverId: 'srv_one',
            stagingKeys: [],
        })
    ).toMatchObject({ objectKeys: [objectKey] });

    expect(() =>
        hostedAttachmentInventorySchema.parse({
            attachments: [],
            objectKeys: ['/private/attachments/object'],
            serverId: 'srv_one',
            stagingKeys: [],
        })
    ).toThrow();
});
