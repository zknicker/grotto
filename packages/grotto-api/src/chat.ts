import * as z from 'zod';
import { attachmentMetadataSchema } from './attachments.ts';
import { messageTaskSchema } from './task-shared.ts';

export const idSchema = z.string().trim().min(1);
const timestampSchema = z.iso.datetime({ offset: true });

export const chatMessageAuthorSchema = z.discriminatedUnion('kind', [
    z
        .object({
            agentId: idSchema,
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
            userId: idSchema,
        })
        .strict(),
    z
        .object({ kind: z.literal('system'), system: z.enum(['reminder', 'session', 'task']) })
        .strict(),
]);

export const chatMessageSchema = z
    .object({
        attachments: z.array(attachmentMetadataSchema).default([]),
        author: chatMessageAuthorSchema,
        chatId: idSchema,
        content: z.string().max(32_000),
        createdAt: timestampSchema,
        id: idSchema,
        nonce: z.string().trim().min(1).max(128),
        /** The real Server-assigned Agent run; human/system messages are null. */
        runId: idSchema.nullable(),
        sequence: z.number().int().positive(),
        serverId: idSchema,
        task: messageTaskSchema.nullable().optional(),
    })
    .strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * Enough of one reply for the anchor's Thread preview: who wrote it and what
 * they said. Authors stay as ids so every surface names them through the same
 * Agent list and member directory the transcript already reads.
 */
export const threadReplyPreviewSchema = z
    .object({
        authorAgentId: idSchema.nullable(),
        authorUserId: idSchema.nullable(),
        content: z.string(),
        createdAt: timestampSchema,
        id: idSchema,
    })
    .strict();

export type ThreadReplyPreview = z.infer<typeof threadReplyPreviewSchema>;

export const threadSummarySchema = z
    .object({
        anchorMessageId: idSchema,
        followed: z.boolean(),
        latestReplyAt: timestampSchema.nullable(),
        // The newest replies, oldest first, for the anchor's preview block.
        recentReplies: z.array(threadReplyPreviewSchema),
        replyCount: z.number().int().nonnegative(),
        threadChatId: idSchema,
        unreadCount: z.number().int().nonnegative(),
    })
    .strict();

export type ThreadSummary = z.infer<typeof threadSummarySchema>;

const chatSendBaseSchema = z
    .object({
        attachmentIds: z.array(idSchema).default([]),
        content: z.string().trim().max(32_000),
        nonce: z.string().trim().min(1).max(128),
        serverId: idSchema,
    })
    .strict();

export const chatSendInputSchema = z
    .union([
        chatSendBaseSchema.extend({
            chatId: idSchema,
            thread: z.object({ anchorMessageId: idSchema }).strict().optional(),
        }),
        chatSendBaseSchema.extend({
            agentId: idSchema,
            targetKind: z.literal('agent-dm'),
        }),
    ])
    .superRefine((input, context) => {
        if (input.content.length === 0 && input.attachmentIds.length === 0) {
            context.addIssue({
                code: 'custom',
                message: 'A Server message needs text or an attachment.',
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

export type ChatSendInput = z.infer<typeof chatSendInputSchema>;

/**
 * Channel appearance. `icon` names a curated hugeicons export (for example
 * `RocketIcon`); `color` is a preset id (for example `violet`). Both are
 * channel-only and null means the default hash glyph / muted box.
 */
export const channelIconSchema = z
    .string()
    .trim()
    .regex(/^[A-Z][A-Za-z0-9]{0,63}Icon$/u);

export const channelColorSchema = z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{0,31}$/u);

const channelAppearanceInputSchema = {
    color: channelColorSchema.nullable().optional(),
    icon: channelIconSchema.nullable().optional(),
};

export const chatSchema = z
    .object({
        archivedAt: timestampSchema.nullable(),
        archivedByUserId: idSchema.nullable(),
        color: channelColorSchema.nullable(),
        createdAt: timestampSchema,
        icon: channelIconSchema.nullable(),
        id: idSchema,
        isAll: z.boolean(),
        kind: z.enum(['channel', 'dm']),
        lastActivityAt: timestampSchema.nullable(),
        lastMessageSequence: z.number().int().nonnegative(),
        name: z.string().min(1).nullable(),
        participantAgentIds: z.array(idSchema),
        participantUserIds: z.array(idSchema),
        peerAgentDisplayName: z.string().min(1).nullable(),
        peerAgentId: idSchema.nullable(),
        peerAgentRetired: z.boolean(),
        peerUserId: idSchema.nullable(),
        serverId: idSchema,
        unreadCount: z.number().int().nonnegative(),
    })
    .strict();

export type Chat = z.infer<typeof chatSchema>;

export const chatGetInputSchema = z.object({ chatId: idSchema, serverId: idSchema }).strict();

export const channelCreateInputSchema = z
    .object({
        ...channelAppearanceInputSchema,
        agentIds: z.array(idSchema).min(1),
        name: z
            .string()
            .trim()
            .min(1)
            .max(32)
            .regex(/^[A-Za-z0-9_-]+$/u),
        serverId: idSchema,
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

export type ChannelCreateInput = z.infer<typeof channelCreateInputSchema>;

export const channelUpdateInputSchema = z
    .object({
        ...channelAppearanceInputSchema,
        agentIds: z.array(idSchema).min(1),
        chatId: idSchema,
        name: z
            .string()
            .trim()
            .min(1)
            .max(32)
            .regex(/^[A-Za-z0-9_-]+$/u),
        serverId: idSchema,
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

export type ChannelUpdateInput = z.infer<typeof channelUpdateInputSchema>;

export const channelLifecycleInputSchema = z
    .object({ chatId: idSchema, serverId: idSchema })
    .strict();

export const channelLifecycleReceiptSchema = z
    .object({
        archivedAt: timestampSchema.nullable(),
        chatId: idSchema,
        serverId: idSchema,
    })
    .strict();

export type ChannelLifecycleReceipt = z.infer<typeof channelLifecycleReceiptSchema>;

export const channelDeleteInputSchema = channelLifecycleInputSchema
    .extend({ confirmation: z.string().trim().min(1).max(32) })
    .strict();

export const channelDeleteReceiptSchema = z
    .object({ chatId: idSchema, serverId: idSchema })
    .strict();

export type ChannelDeleteReceipt = z.infer<typeof channelDeleteReceiptSchema>;

export const ensureDmInputSchema = z
    .object({
        peerUserId: idSchema,
        serverId: idSchema,
    })
    .strict();

export const ensureAgentDmInputSchema = z
    .object({
        agentId: idSchema,
        serverId: idSchema,
    })
    .strict();

export const chatListInputSchema = z.object({ serverId: idSchema }).strict();

export const chatListSchema = z.array(chatSchema);

export const chatMessageReceiptSchema = z
    .object({
        eventCursor: z.string().regex(/^[1-9]\d*$/u),
        idempotent: z.boolean(),
        message: chatMessageSchema,
        threadChatId: idSchema.nullable(),
    })
    .strict();

export type ChatMessageReceipt = z.infer<typeof chatMessageReceiptSchema>;

export const chatMessagesInputSchema = z
    .object({
        beforeSequence: z.number().int().positive().optional(),
        chatId: idSchema,
        limit: z.number().int().min(1).max(100).default(50),
        serverId: idSchema,
    })
    .strict();

export const chatMessagePageSchema = z
    .object({
        messages: z.array(chatMessageSchema),
        nextBeforeSequence: z.number().int().positive().nullable(),
        threads: z.array(threadSummarySchema),
    })
    .strict();

export const threadFollowInputSchema = z
    .object({
        follow: z.boolean(),
        serverId: idSchema,
        threadChatId: idSchema,
    })
    .strict();

export const threadContextInputSchema = z
    .object({
        serverId: idSchema,
        threadChatId: idSchema,
    })
    .strict();

export const threadContextSchema = z
    .object({
        anchorMessageId: idSchema,
        parentChatId: idSchema,
        serverId: idSchema,
        threadChatId: idSchema,
    })
    .strict();

export const threadFollowReceiptSchema = z
    .object({
        eventCursor: z.string().regex(/^[1-9]\d*$/u),
        followed: z.boolean(),
        serverId: idSchema,
        threadChatId: idSchema,
    })
    .strict();

export const chatMarkReadInputSchema = z
    .object({
        chatId: idSchema,
        sequence: z.number().int().nonnegative(),
        serverId: idSchema,
    })
    .strict();

export const chatReadReceiptSchema = z
    .object({
        chatId: idSchema,
        eventCursor: z
            .string()
            .regex(/^[1-9]\d*$/u)
            .nullable(),
        sequence: z.number().int().nonnegative(),
        serverId: idSchema,
    })
    .strict();

export type ChatReadReceipt = z.infer<typeof chatReadReceiptSchema>;

export const chatSearchInputSchema = z
    .object({
        /** Only messages created at or after this instant. */
        after: timestampSchema.optional(),
        authorAgentId: idSchema.optional(),
        authorUserId: idSchema.optional(),
        chatId: idSchema.optional(),
        limit: z.number().int().min(1).max(100).default(50),
        query: z.string().trim().min(1).max(500),
        serverId: idSchema,
    })
    .strict();

export const chatSearchResultSchema = chatMessageSchema.extend({
    chatArchivedAt: timestampSchema.nullable(),
});

export type ChatSearchResult = z.infer<typeof chatSearchResultSchema>;

export const chatSearchResultsSchema = z.array(chatSearchResultSchema);

export const messageCreatedEventSchema = z
    .object({
        chatId: idSchema,
        createdAt: timestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: idSchema,
        messageId: idSchema,
        parentChatId: idSchema.nullable(),
        sequence: z.number().int().positive(),
        serverId: idSchema,
        type: z.literal('message.created'),
    })
    .strict();

export const chatReadEventSchema = z
    .object({
        chatId: idSchema,
        createdAt: timestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: idSchema,
        parentChatId: idSchema.nullable(),
        sequence: z.number().int().nonnegative(),
        serverId: idSchema,
        type: z.literal('chat.read'),
    })
    .strict();

export const threadFollowUpdatedEventSchema = z
    .object({
        chatId: idSchema,
        createdAt: timestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: idSchema,
        parentChatId: idSchema,
        sequence: z.number().int().nonnegative(),
        serverId: idSchema,
        type: z.literal('thread.follow.updated'),
    })
    .strict();

export const taskChangedEventSchema = z
    .object({
        chatId: idSchema,
        createdAt: timestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: idSchema,
        messageId: idSchema,
        parentChatId: z.null(),
        sequence: z.number().int().positive(),
        serverId: idSchema,
        type: z.enum(['task.created', 'task.updated']),
    })
    .strict();

export const taskLabelChangedEventSchema = z
    .object({
        chatId: z.null(),
        createdAt: timestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: idSchema,
        labelId: idSchema,
        parentChatId: z.null(),
        sequence: z.literal(0),
        serverId: idSchema,
        type: z.literal('task.label.updated'),
    })
    .strict();

export const reminderChangedEventSchema = z
    .object({
        action: z.enum(['canceled', 'fired', 'scheduled', 'snoozed', 'updated']),
        chatId: idSchema,
        createdAt: timestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: idSchema,
        parentChatId: idSchema.nullable(),
        reminderId: idSchema,
        sequence: z.number().int().nonnegative(),
        serverId: idSchema,
        type: z.literal('reminder.changed'),
    })
    .strict();

export type ReminderChangedEvent = z.infer<typeof reminderChangedEventSchema>;

/**
 * One Chat's existence changing: `created` for a new Channel or the first
 * resolution of a DM, `updated` for a Channel rename or Agent participant
 * change, plus the archive lifecycle. Delivery is Chat-access scoped, so a DM
 * `created` event reaches its two members and nobody else.
 */
export const chatLifecycleEventSchema = z
    .object({
        action: z.enum(['archived', 'created', 'deleted', 'unarchived', 'updated']),
        chatId: idSchema,
        createdAt: timestampSchema,
        cursor: z.string().regex(/^[1-9]\d*$/u),
        id: idSchema,
        parentChatId: z.null(),
        sequence: z.literal(0),
        serverId: idSchema,
        type: z.literal('chat.lifecycle'),
    })
    .strict();

export const serverdurableeventSchema = z.discriminatedUnion('type', [
    messageCreatedEventSchema,
    chatReadEventSchema,
    threadFollowUpdatedEventSchema,
    taskChangedEventSchema,
    taskLabelChangedEventSchema,
    reminderChangedEventSchema,
    chatLifecycleEventSchema,
]);

export type ServerDurableEvent = z.infer<typeof serverdurableeventSchema>;

export const chatEventsInputSchema = z
    .object({
        afterCursor: z.string().regex(/^\d+$/u).default('0'),
        limit: z.number().int().min(1).max(500).default(100),
        serverId: idSchema,
    })
    .strict();

export const chatEventsSchema = z.array(serverdurableeventSchema);

export const chatEventHeadSchema = z.object({ cursor: z.string().regex(/^\d+$/u) }).strict();

export const chatEventSubscriptionInputSchema = z.object({ serverId: idSchema }).strict();

export const compositionPublishInputSchema = z
    .object({
        chatId: idSchema,
        compositionId: idSchema,
        serverId: idSchema,
        text: z.string().max(2000).nullable(),
    })
    .strict();

export const compositionSubscriptionInputSchema = z
    .object({
        chatId: idSchema,
        serverId: idSchema,
    })
    .strict();

export const compositionEventSchema = z
    .object({
        actorUserId: idSchema,
        chatId: idSchema,
        compositionId: idSchema,
        emittedAt: timestampSchema,
        serverId: idSchema,
        text: z.string().max(2000).nullable(),
    })
    .strict();

export type CompositionEvent = z.infer<typeof compositionEventSchema>;

export const compositionPublishedSchema = z.object({ accepted: z.literal(true) }).strict();
