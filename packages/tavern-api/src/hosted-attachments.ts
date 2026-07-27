import { z } from 'zod';

const hostedIdSchema = z.string().trim().min(1);
const hostedAttachmentFilenameSchema = z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => !/[/\\\u0000-\u001f\u007f]/u.test(value), {
        message: 'Attachment filenames cannot contain path separators or control characters.',
    });

export const hostedAttachmentMetadataSchema = z
    .object({
        filename: hostedAttachmentFilenameSchema,
        id: hostedIdSchema,
        mediaType: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u)
            .max(255),
        sizeBytes: z.number().int().min(0),
    })
    .strict();

export type HostedAttachmentMetadata = z.infer<typeof hostedAttachmentMetadataSchema>;

export const hostedAttachmentReserveInputSchema = z
    .object({
        chatId: hostedIdSchema,
        filename: hostedAttachmentFilenameSchema,
        mediaType: hostedAttachmentMetadataSchema.shape.mediaType,
        nonce: z.string().trim().min(1).max(128),
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedAttachmentReserveInput = z.infer<typeof hostedAttachmentReserveInputSchema>;

export const hostedAttachmentReservationSchema = z
    .object({
        attachmentId: hostedIdSchema,
        idempotent: z.boolean(),
        maxSizeBytes: z.number().int().positive(),
        state: z.enum(['pending', 'uploading', 'finalizing', 'ready', 'failed']),
    })
    .strict();

export type HostedAttachmentReservation = z.infer<typeof hostedAttachmentReservationSchema>;

export const hostedAttachmentUploadResultSchema = z
    .object({
        attachment: hostedAttachmentMetadataSchema,
        idempotent: z.boolean(),
    })
    .strict();

export type HostedAttachmentUploadResult = z.infer<typeof hostedAttachmentUploadResultSchema>;

const hostedAttachmentStateSchema = z.enum([
    'pending',
    'uploading',
    'finalizing',
    'ready',
    'failed',
]);
const hostedAttachmentStorageKeySchema = z
    .string()
    .regex(/^servers\/[a-f0-9]{64}\/(objects|staging)\/[a-f0-9]{64}$/u);

export const hostedAttachmentInventoryInputSchema = z.object({ serverId: hostedIdSchema }).strict();

export const hostedAttachmentInventorySchema = z
    .object({
        attachments: z.array(
            z
                .object({
                    attachmentId: hostedIdSchema,
                    expectedObjectKey: hostedAttachmentStorageKeySchema,
                    expectedStagingKey: hostedAttachmentStorageKeySchema.nullable(),
                    messageId: hostedIdSchema.nullable(),
                    state: hostedAttachmentStateSchema,
                })
                .strict()
        ),
        objectKeys: z.array(hostedAttachmentStorageKeySchema),
        serverId: hostedIdSchema,
        stagingKeys: z.array(hostedAttachmentStorageKeySchema),
    })
    .strict();

export type HostedAttachmentInventory = z.infer<typeof hostedAttachmentInventorySchema>;
