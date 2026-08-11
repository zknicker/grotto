import * as z from 'zod';
import { hostedAttachmentMetadataSchema } from './hosted-attachments.ts';
import { hostedMessageTaskSchema } from './hosted-task-shared.ts';

export const hostedIdSchema = z.string().trim().min(1);
const hostedTimestampSchema = z.iso.datetime({ offset: true });

export const hostedChatMessageAuthorSchema = z.discriminatedUnion('kind', [
    z
        .object({
            agentId: hostedIdSchema,
            kind: z.literal('agent'),
            profile: z
                .object({
                    avatarUrl: z.string().nullable(),
                    deleted: z.boolean(),
                    description: z.string().nullable(),
                    displayName: z.string().min(1),
                })
                .strict()
                .optional(),
        })
        .strict(),
    z
        .object({
            kind: z.literal('human'),
            profile: z
                .object({
                    avatarUrl: z.string().nullable(),
                    deleted: z.boolean(),
                    description: z.string().nullable(),
                    displayName: z.string().min(1),
                })
                .strict()
                .optional(),
            userId: hostedIdSchema,
        })
        .strict(),
    z
        .object({ kind: z.literal('system'), system: z.enum(['reminder', 'session', 'task']) })
        .strict(),
]);

export const hostedChatMessageSchema = z
    .object({
        attachments: z.array(hostedAttachmentMetadataSchema).default([]),
        author: hostedChatMessageAuthorSchema,
        chatId: hostedIdSchema,
        content: z.string().max(32_000),
        createdAt: hostedTimestampSchema,
        id: hostedIdSchema,
        nonce: z.string().trim().min(1).max(128),
        /** The real Server-assigned Agent run; human/system messages are null. */
        runId: hostedIdSchema.nullable(),
        sequence: z.number().int().positive(),
        serverId: hostedIdSchema,
        task: hostedMessageTaskSchema.nullable().optional(),
    })
    .strict();

export type HostedChatMessage = z.infer<typeof hostedChatMessageSchema>;

/**
 * Enough of one reply for the anchor's Thread preview: who wrote it and what
 * they said. Authors stay as ids so every surface names them through the same
 * Agent list and member directory the transcript already reads.
 */
export const hostedThreadReplyPreviewSchema = z
    .object({
        authorAgentId: hostedIdSchema.nullable(),
        authorUserId: hostedIdSchema.nullable(),
        content: z.string(),
        createdAt: hostedTimestampSchema,
        id: hostedIdSchema,
    })
    .strict();

export type HostedThreadReplyPreview = z.infer<typeof hostedThreadReplyPreviewSchema>;

export const hostedThreadSummarySchema = z
    .object({
        anchorMessageId: hostedIdSchema,
        followed: z.boolean(),
        latestReplyAt: hostedTimestampSchema.nullable(),
        // The newest replies, oldest first, for the anchor's preview block.
        recentReplies: z.array(hostedThreadReplyPreviewSchema),
        replyCount: z.number().int().nonnegative(),
        threadChatId: hostedIdSchema,
        unreadCount: z.number().int().nonnegative(),
    })
    .strict();

export type HostedThreadSummary = z.infer<typeof hostedThreadSummarySchema>;

export const hostedChatSendInputSchema = z
    .object({
        attachmentIds: z.array(hostedIdSchema).default([]),
        chatId: hostedIdSchema,
        content: z.string().trim().max(32_000),
        nonce: z.string().trim().min(1).max(128),
        serverId: hostedIdSchema,
        thread: z.object({ anchorMessageId: hostedIdSchema }).strict().optional(),
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
        archivedAt: hostedTimestampSchema.nullable(),
        archivedByUserId: hostedIdSchema.nullable(),
        createdAt: hostedTimestampSchema,
        id: hostedIdSchema,
        isAll: z.boolean(),
        kind: z.enum(['channel', 'dm']),
        lastActivityAt: hostedTimestampSchema.nullable(),
        lastMessageSequence: z.number().int().nonnegative(),
        name: z.string().min(1).nullable(),
        participantAgentIds: z.array(hostedIdSchema),
        participantUserIds: z.array(hostedIdSchema),
        peerAgentDisplayName: z.string().min(1).nullable(),
        peerAgentId: hostedIdSchema.nullable(),
        peerAgentRetired: z.boolean(),
        peerUserId: hostedIdSchema.nullable(),
        serverId: hostedIdSchema,
        unreadCount: z.number().int().nonnegative(),
    })
    .strict();

export type HostedChat = z.infer<typeof hostedChatSchema>;

export const hostedChatGetInputSchema = z
    .object({ chatId: hostedIdSchema, serverId: hostedIdSchema })
    .strict();

export const hostedChannelCreateInputSchema = z
    .object({
        agentIds: z.array(hostedIdSchema).min(1),
        name: z
            .string()
            .trim()
            .min(1)
            .max(32)
            .regex(/^[A-Za-z0-9_-]+$/u),
        serverId: hostedIdSchema,
    })
    .strict()
    .superRefine((input, context) => {
        if (new Set(input.agentIds).size !== input.agentIds.length) {
            context.addIssue({
                code: 'custom',
                message: 'Channel agents must be unique.',
                path: ['agentIds'],
            });
        }
    });

export type HostedChannelCreateInput = z.infer<typeof hostedChannelCreateInputSchema>;

export const hostedChannelUpdateInputSchema = z
    .object({
        agentIds: z.array(hostedIdSchema).min(1),
        chatId: hostedIdSchema,
        name: z
            .string()
            .trim()
            .min(1)
            .max(32)
            .regex(/^[A-Za-z0-9_-]+$/u),
        serverId: hostedIdSchema,
    })
    .strict()
    .superRefine((input, context) => {
        if (new Set(input.agentIds).size !== input.agentIds.length) {
            context.addIssue({
                code: 'custom',
                message: 'Agent ids must be unique.',
                path: ['agentIds'],
            });
        }
    });

export type HostedChannelUpdateInput = z.infer<typeof hostedChannelUpdateInputSchema>;

export const hostedChannelLifecycleInputSchema = z
    .object({ chatId: hostedIdSchema, serverId: hostedIdSchema })
    .strict();

export const hostedChannelLifecycleReceiptSchema = z
    .object({
        archivedAt: hostedTimestampSchema.nullable(),
        chatId: hostedIdSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedChannelLifecycleReceipt = z.infer<typeof hostedChannelLifecycleReceiptSchema>;

export const hostedChannelDeleteInputSchema = hostedChannelLifecycleInputSchema
    .extend({ confirmation: z.string().trim().min(1).max(32) })
    .strict();

export const hostedChannelDeleteReceiptSchema = z
    .object({ chatId: hostedIdSchema, serverId: hostedIdSchema })
    .strict();

export type HostedChannelDeleteReceipt = z.infer<typeof hostedChannelDeleteReceiptSchema>;

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
        threadChatId: hostedIdSchema.nullable(),
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
        threads: z.array(hostedThreadSummarySchema),
    })
    .strict();

export const hostedThreadFollowInputSchema = z
    .object({
        follow: z.boolean(),
        serverId: hostedIdSchema,
        threadChatId: hostedIdSchema,
    })
    .strict();

export const hostedThreadContextInputSchema = z
    .object({
        serverId: hostedIdSchema,
        threadChatId: hostedIdSchema,
    })
    .strict();

export const hostedThreadContextSchema = z
    .object({
        anchorMessageId: hostedIdSchema,
        parentChatId: hostedIdSchema,
        serverId: hostedIdSchema,
        threadChatId: hostedIdSchema,
    })
    .strict();

export const hostedThreadFollowReceiptSchema = z
    .object({
        eventCursor: z.string().regex(/^[1-9]\d*$/u),
        followed: z.boolean(),
        serverId: hostedIdSchema,
        threadChatId: hostedIdSchema,
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

export const hostedChatSearchResultSchema = hostedChatMessageSchema.extend({
    chatArchivedAt: hostedTimestampSchema.nullable(),
});

export type HostedChatSearchResult = z.infer<typeof hostedChatSearchResultSchema>;

export const hostedChatSearchResultsSchema = z.array(hostedChatSearchResultSchema);

export const hostedMessageCreatedEventSchema = z
    .object({
        chatId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: hostedIdSchema,
        messageId: hostedIdSchema,
        parentChatId: hostedIdSchema.nullable(),
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
        parentChatId: hostedIdSchema.nullable(),
        sequence: z.number().int().nonnegative(),
        serverId: hostedIdSchema,
        type: z.literal('chat.read'),
    })
    .strict();

export const hostedThreadFollowUpdatedEventSchema = z
    .object({
        chatId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: hostedIdSchema,
        parentChatId: hostedIdSchema,
        sequence: z.number().int().nonnegative(),
        serverId: hostedIdSchema,
        type: z.literal('thread.follow.updated'),
    })
    .strict();

export const hostedTaskChangedEventSchema = z
    .object({
        chatId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: hostedIdSchema,
        messageId: hostedIdSchema,
        parentChatId: z.null(),
        sequence: z.number().int().positive(),
        serverId: hostedIdSchema,
        type: z.enum(['task.created', 'task.updated']),
    })
    .strict();

export const hostedTaskLabelChangedEventSchema = z
    .object({
        chatId: z.null(),
        createdAt: hostedTimestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: hostedIdSchema,
        labelId: hostedIdSchema,
        parentChatId: z.null(),
        sequence: z.literal(0),
        serverId: hostedIdSchema,
        type: z.literal('task.label.updated'),
    })
    .strict();

export const hostedReminderChangedEventSchema = z
    .object({
        action: z.enum(['canceled', 'fired', 'scheduled', 'snoozed', 'updated']),
        chatId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: hostedIdSchema,
        parentChatId: hostedIdSchema.nullable(),
        reminderId: hostedIdSchema,
        sequence: z.number().int().nonnegative(),
        serverId: hostedIdSchema,
        type: z.literal('reminder.changed'),
    })
    .strict();

export type HostedReminderChangedEvent = z.infer<typeof hostedReminderChangedEventSchema>;

/**
 * One Chat's existence changing: `created` for a new Channel or the first
 * resolution of a DM, `updated` for a Channel rename or Agent participant
 * change, plus the archive lifecycle. Delivery is Chat-access scoped, so a DM
 * `created` event reaches its two members and nobody else.
 */
export const hostedChatLifecycleEventSchema = z
    .object({
        action: z.enum(['archived', 'created', 'deleted', 'unarchived', 'updated']),
        chatId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: hostedIdSchema,
        parentChatId: z.null(),
        sequence: z.literal(0),
        serverId: hostedIdSchema,
        type: z.literal('chat.lifecycle'),
    })
    .strict();

export const hostedDurableEventSchema = z.discriminatedUnion('type', [
    hostedMessageCreatedEventSchema,
    hostedChatReadEventSchema,
    hostedThreadFollowUpdatedEventSchema,
    hostedTaskChangedEventSchema,
    hostedTaskLabelChangedEventSchema,
    hostedReminderChangedEventSchema,
    hostedChatLifecycleEventSchema,
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
