import * as z from 'zod';

const idSchema = z.string().trim().min(1);
const attachmentFilenameSchema = z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => !/[/\\\u0000-\u001f\u007f]/u.test(value), {
        message: 'Attachment filenames cannot contain path separators or control characters.',
    });

export const attachmentMetadataSchema = z
    .object({
        filename: attachmentFilenameSchema,
        id: idSchema,
        mediaType: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u)
            .max(255),
        sizeBytes: z.number().int().min(0),
    })
    .strict();

export type AttachmentMetadata = z.infer<typeof attachmentMetadataSchema>;

export const attachmentReserveInputSchema = z
    .object({
        chatId: idSchema,
        filename: attachmentFilenameSchema,
        mediaType: attachmentMetadataSchema.shape.mediaType,
        nonce: z.string().trim().min(1).max(128),
        serverId: idSchema,
    })
    .strict();

export type AttachmentReserveInput = z.infer<typeof attachmentReserveInputSchema>;

export const attachmentReservationSchema = z
    .object({
        attachmentId: idSchema,
        idempotent: z.boolean(),
        maxSizeBytes: z.number().int().positive(),
        state: z.enum(['pending', 'uploading', 'finalizing', 'ready', 'failed']),
    })
    .strict();

export type AttachmentReservation = z.infer<typeof attachmentReservationSchema>;

export const attachmentUploadResultSchema = z
    .object({
        attachment: attachmentMetadataSchema,
        idempotent: z.boolean(),
    })
    .strict();

export type AttachmentUploadResult = z.infer<typeof attachmentUploadResultSchema>;

const attachmentStateSchema = z.enum(['pending', 'uploading', 'finalizing', 'ready', 'failed']);
const attachmentStorageKeySchema = z
    .string()
    .regex(/^servers\/[a-f0-9]{64}\/(objects|staging)\/[a-f0-9]{64}$/u);

export const attachmentInventoryInputSchema = z.object({ serverId: idSchema }).strict();

export const attachmentInventorySchema = z
    .object({
        attachments: z.array(
            z
                .object({
                    attachmentId: idSchema,
                    expectedObjectKey: attachmentStorageKeySchema,
                    expectedStagingKey: attachmentStorageKeySchema.nullable(),
                    messageId: idSchema.nullable(),
                    state: attachmentStateSchema,
                })
                .strict()
        ),
        objectKeys: z.array(attachmentStorageKeySchema),
        serverId: idSchema,
        stagingKeys: z.array(attachmentStorageKeySchema),
    })
    .strict();

export type AttachmentInventory = z.infer<typeof attachmentInventorySchema>;
