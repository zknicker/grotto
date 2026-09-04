import * as z from 'zod';
import { idSchema, reminderChangedEventSchema } from './chat.ts';

const timestampSchema = z.iso.datetime({ offset: true });

export const reminderSchema = z
    .object({
        anchorChatId: idSchema,
        anchorMessageId: idSchema,
        createdAt: timestampSchema,
        fireAt: timestampSchema,
        hasScript: z.boolean(),
        id: idSchema,
        ownerAgentId: idSchema,
        ownerHandle: z.string().min(1),
        repeat: z.string().min(1).nullable(),
        scriptBytes: z.number().int().nonnegative().max(16_384),
        status: z.enum(['canceled', 'fired', 'scheduled']),
        timezone: z.string().min(1),
        title: z.string().min(1).max(300),
        updatedAt: timestampSchema,
        version: z.number().int().positive(),
    })
    .strict();

export type Reminder = z.infer<typeof reminderSchema>;

export const reminderListInputSchema = z
    .object({
        agentId: idSchema.optional(),
        serverId: idSchema,
        status: z.enum(['canceled', 'fired', 'scheduled']).optional(),
    })
    .strict();

export const reminderListSchema = z.array(reminderSchema);

export const reminderRunsInputSchema = z
    .object({
        reminderId: idSchema,
        serverId: idSchema,
    })
    .strict();

export const reminderFireSchema = z
    .object({
        firedAt: timestampSchema,
        id: idSchema,
        reminderId: idSchema,
        scheduledFor: timestampSchema,
    })
    .strict();

export const reminderRunsSchema = z.array(reminderFireSchema);

export const reminderCancelInputSchema = z
    .object({
        commandId: z.string().trim().min(1).max(128),
        expectedVersion: z.number().int().positive(),
        reminderId: idSchema,
        serverId: idSchema,
    })
    .strict();

export const reminderMutationResultSchema = z
    .object({
        idempotent: z.boolean(),
        reminder: reminderSchema,
    })
    .strict();

export const reminderChangesInputSchema = z
    .object({
        afterCursor: z.string().regex(/^\d+$/u).default('0'),
        limit: z.number().int().min(1).max(500).default(100),
        serverId: idSchema,
    })
    .strict();

export const reminderChangesSchema = z.array(reminderChangedEventSchema);

export const reminderEventSubscriptionInputSchema = z.object({ serverId: idSchema }).strict();
