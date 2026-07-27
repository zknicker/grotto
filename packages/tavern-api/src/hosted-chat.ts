import * as z from 'zod';
import { hostedMessageTaskSchema } from './hosted-task-shared.ts';

export const hostedIdSchema = z.string().trim().min(1);
const hostedTimestampSchema = z.iso.datetime({ offset: true });

export const hostedChatMessageAuthorSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('human'), userId: hostedIdSchema }).strict(),
    z.object({ kind: z.literal('system'), system: z.literal('reminder') }).strict(),
]);

export const hostedChatMessageSchema = z
    .object({
        author: hostedChatMessageAuthorSchema,
        chatId: hostedIdSchema,
        content: z.string().min(1),
        createdAt: hostedTimestampSchema,
        id: hostedIdSchema,
        nonce: z.string().trim().min(1).max(128),
        sequence: z.number().int().positive(),
        serverId: hostedIdSchema,
        task: hostedMessageTaskSchema.nullable().optional(),
    })
    .strict();

export type HostedChatMessage = z.infer<typeof hostedChatMessageSchema>;

export const hostedThreadSummarySchema = z
    .object({
        anchorMessageId: hostedIdSchema,
        followed: z.boolean(),
        latestReplyAt: hostedTimestampSchema.nullable(),
        replyCount: z.number().int().nonnegative(),
        threadChatId: hostedIdSchema,
        unreadCount: z.number().int().nonnegative(),
    })
    .strict();

export type HostedThreadSummary = z.infer<typeof hostedThreadSummarySchema>;

export const hostedChatSendInputSchema = z
    .object({
        chatId: hostedIdSchema,
        content: z.string().trim().min(1).max(32_000),
        nonce: z.string().trim().min(1).max(128),
        serverId: hostedIdSchema,
        thread: z.object({ anchorMessageId: hostedIdSchema }).strict().optional(),
    })
    .strict();

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

export const hostedChatSearchResultsSchema = z.array(hostedChatMessageSchema);

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

export const hostedDurableEventSchema = z.discriminatedUnion('type', [
    hostedMessageCreatedEventSchema,
    hostedChatReadEventSchema,
    hostedThreadFollowUpdatedEventSchema,
    hostedTaskChangedEventSchema,
    hostedTaskLabelChangedEventSchema,
    hostedReminderChangedEventSchema,
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
