import * as z from 'zod';
import { hostedIdSchema, hostedReminderChangedEventSchema } from './hosted-chat.ts';

const hostedTimestampSchema = z.iso.datetime({ offset: true });

export const hostedReminderSchema = z
    .object({
        anchorChatId: hostedIdSchema,
        anchorMessageId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
        fireAt: hostedTimestampSchema,
        hasScript: z.boolean(),
        id: hostedIdSchema,
        ownerAgentId: hostedIdSchema,
        ownerHandle: z.string().min(1),
        repeat: z.string().min(1).nullable(),
        scriptBytes: z.number().int().nonnegative().max(16_384),
        status: z.enum(['canceled', 'fired', 'scheduled']),
        timezone: z.string().min(1),
        title: z.string().min(1).max(300),
        updatedAt: hostedTimestampSchema,
        version: z.number().int().positive(),
    })
    .strict();

export type HostedReminder = z.infer<typeof hostedReminderSchema>;

export const hostedReminderListInputSchema = z
    .object({
        agentId: hostedIdSchema.optional(),
        serverId: hostedIdSchema,
        status: z.enum(['canceled', 'fired', 'scheduled']).optional(),
    })
    .strict();

export const hostedReminderListSchema = z.array(hostedReminderSchema);

export const hostedReminderRunsInputSchema = z
    .object({
        reminderId: hostedIdSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedReminderFireSchema = z
    .object({
        firedAt: hostedTimestampSchema,
        id: hostedIdSchema,
        receiptMessageId: hostedIdSchema,
        reminderId: hostedIdSchema,
        scheduledFor: hostedTimestampSchema,
    })
    .strict();

export const hostedReminderRunsSchema = z.array(hostedReminderFireSchema);

export const hostedReminderCancelInputSchema = z
    .object({
        commandId: z.string().trim().min(1).max(128),
        expectedVersion: z.number().int().positive(),
        reminderId: hostedIdSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedReminderMutationResultSchema = z
    .object({
        idempotent: z.boolean(),
        reminder: hostedReminderSchema,
    })
    .strict();

export const hostedReminderChangesInputSchema = z
    .object({
        afterCursor: z.string().regex(/^\d+$/u).default('0'),
        limit: z.number().int().min(1).max(500).default(100),
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedReminderChangesSchema = z.array(hostedReminderChangedEventSchema);

export const hostedReminderEventSubscriptionInputSchema = z
    .object({ serverId: hostedIdSchema })
    .strict();
