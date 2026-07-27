import { z } from 'zod';
import { hostedAttachmentMetadataSchema } from './hosted-attachments.ts';

const hostedIdSchema = z.string().trim().min(1);
const hostedTimestampSchema = z.iso.datetime({ offset: true });

export const hostedChatMessageSchema = z
    .object({
        attachments: z.array(hostedAttachmentMetadataSchema).default([]),
        authorUserId: hostedIdSchema,
        chatId: hostedIdSchema,
        content: z.string().max(32_000),
        createdAt: hostedTimestampSchema,
        id: hostedIdSchema,
        nonce: z.string().trim().min(1).max(128),
        sequence: z.number().int().positive(),
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedChatMessage = z.infer<typeof hostedChatMessageSchema>;

export const hostedChatSendInputSchema = z
    .object({
        attachmentIds: z.array(hostedIdSchema).default([]),
        chatId: hostedIdSchema,
        content: z.string().trim().max(32_000),
        nonce: z.string().trim().min(1).max(128),
        serverId: hostedIdSchema,
    })
    .strict()
    .superRefine((input, context) => {
        if (input.content.length === 0 && input.attachmentIds.length === 0) {
            context.addIssue({
                code: 'custom',
                message: 'A hosted message needs text or an attachment.',
                path: ['content'],
            });
        }

        if (new Set(input.attachmentIds).size !== input.attachmentIds.length) {
            context.addIssue({
                code: 'custom',
                message: 'Attachment ids must be unique.',
                path: ['attachmentIds'],
            });
        }
    });

export type HostedChatSendInput = z.infer<typeof hostedChatSendInputSchema>;

export const hostedChatSchema = z
    .object({
        createdAt: hostedTimestampSchema,
        id: hostedIdSchema,
        isAll: z.boolean(),
        kind: z.enum(['channel', 'dm']),
        lastActivityAt: hostedTimestampSchema.nullable(),
        lastMessageSequence: z.number().int().nonnegative(),
        name: z.string().min(1).nullable(),
        participantUserIds: z.array(hostedIdSchema),
        peerUserId: hostedIdSchema.nullable(),
        serverId: hostedIdSchema,
        unreadCount: z.number().int().nonnegative(),
    })
    .strict();

export type HostedChat = z.infer<typeof hostedChatSchema>;

export const hostedEnsureDmInputSchema = z
    .object({
        peerUserId: hostedIdSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedChatListInputSchema = z.object({ serverId: hostedIdSchema }).strict();

export const hostedChatListSchema = z.array(hostedChatSchema);

export const hostedChatMessageReceiptSchema = z
    .object({
        eventCursor: z.string().regex(/^[1-9]\d*$/u),
        idempotent: z.boolean(),
        message: hostedChatMessageSchema,
    })
    .strict();

export type HostedChatMessageReceipt = z.infer<typeof hostedChatMessageReceiptSchema>;

export const hostedChatMessagesInputSchema = z
    .object({
        beforeSequence: z.number().int().positive().optional(),
        chatId: hostedIdSchema,
        limit: z.number().int().min(1).max(100).default(50),
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedChatMessagePageSchema = z
    .object({
        messages: z.array(hostedChatMessageSchema),
        nextBeforeSequence: z.number().int().positive().nullable(),
    })
    .strict();

export const hostedChatMarkReadInputSchema = z
    .object({
        chatId: hostedIdSchema,
        sequence: z.number().int().nonnegative(),
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedChatReadReceiptSchema = z
    .object({
        chatId: hostedIdSchema,
        eventCursor: z
            .string()
            .regex(/^[1-9]\d*$/u)
            .nullable(),
        sequence: z.number().int().nonnegative(),
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedChatReadReceipt = z.infer<typeof hostedChatReadReceiptSchema>;

export const hostedChatSearchInputSchema = z
    .object({
        chatId: hostedIdSchema.optional(),
        limit: z.number().int().min(1).max(100).default(50),
        query: z.string().trim().min(1).max(500),
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedChatSearchResultsSchema = z.array(hostedChatMessageSchema);

export const hostedMessageCreatedEventSchema = z
    .object({
        chatId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: hostedIdSchema,
        messageId: hostedIdSchema,
        sequence: z.number().int().positive(),
        serverId: hostedIdSchema,
        type: z.literal('message.created'),
    })
    .strict();

export const hostedChatReadEventSchema = z
    .object({
        chatId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: hostedIdSchema,
        sequence: z.number().int().nonnegative(),
        serverId: hostedIdSchema,
        type: z.literal('chat.read'),
    })
    .strict();

export const hostedDurableEventSchema = z.discriminatedUnion('type', [
    hostedMessageCreatedEventSchema,
    hostedChatReadEventSchema,
]);

export type HostedDurableEvent = z.infer<typeof hostedDurableEventSchema>;

export const hostedChatEventsInputSchema = z
    .object({
        afterCursor: z.string().regex(/^\d+$/u).default('0'),
        limit: z.number().int().min(1).max(500).default(100),
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedChatEventsSchema = z.array(hostedDurableEventSchema);

export const hostedChatEventHeadSchema = z.object({ cursor: z.string().regex(/^\d+$/u) }).strict();

export const hostedChatEventSubscriptionInputSchema = z
    .object({ serverId: hostedIdSchema })
    .strict();

export const hostedCompositionPublishInputSchema = z
    .object({
        chatId: hostedIdSchema,
        compositionId: hostedIdSchema,
        serverId: hostedIdSchema,
        text: z.string().max(2000).nullable(),
    })
    .strict();

export const hostedCompositionSubscriptionInputSchema = z
    .object({
        chatId: hostedIdSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedCompositionEventSchema = z
    .object({
        actorUserId: hostedIdSchema,
        chatId: hostedIdSchema,
        compositionId: hostedIdSchema,
        emittedAt: hostedTimestampSchema,
        serverId: hostedIdSchema,
        text: z.string().max(2000).nullable(),
    })
    .strict();

export type HostedCompositionEvent = z.infer<typeof hostedCompositionEventSchema>;

export const hostedCompositionPublishedSchema = z.object({ accepted: z.literal(true) }).strict();
