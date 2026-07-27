import * as z from 'zod';
import { hostedChatMessageSchema, hostedIdSchema } from './hosted-chat.ts';
import {
    hostedMessageTaskSchema,
    hostedTaskLabelColors,
    hostedTaskLabelSchema,
    hostedTaskPriorities,
    hostedTaskStatuses,
} from './hosted-task-shared.ts';

export const hostedTaskListInputSchema = z
    .object({
        chatId: hostedIdSchema.optional(),
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedTaskListItemSchema = z
    .object({
        chatKind: z.enum(['channel', 'dm']),
        chatName: z.string().nullable(),
        message: hostedChatMessageSchema,
        task: hostedMessageTaskSchema,
    })
    .strict();

export const hostedTaskListSchema = z.array(hostedTaskListItemSchema);

export const hostedTaskAssigneesInputSchema = z
    .object({
        messageId: hostedIdSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedTaskAssigneeSchema = z
    .object({
        role: z.enum(['admin', 'member', 'owner']),
        userId: hostedIdSchema,
    })
    .strict();

export const hostedTaskAssigneesSchema = z.array(hostedTaskAssigneeSchema);

export const hostedTaskPromoteInputSchema = z
    .object({
        messageId: hostedIdSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedTaskPromotionSchema = z
    .object({
        idempotent: z.boolean(),
        task: hostedMessageTaskSchema,
    })
    .strict();

export const hostedTaskCreateInputSchema = z
    .object({
        assigneeUserId: hostedIdSchema.optional(),
        chatId: hostedIdSchema,
        content: z.string().trim().min(1).max(32_000),
        nonce: z.string().trim().min(1).max(128),
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedTaskMutationInputSchema = z
    .object({
        expectedVersion: z.number().int().positive(),
        messageId: hostedIdSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedTaskAssignInputSchema = hostedTaskMutationInputSchema.extend({
    assigneeUserId: hostedIdSchema.nullable(),
});

export const hostedTaskUpdateInputSchema = hostedTaskMutationInputSchema.extend({
    patch: z
        .object({
            labelIds: z.array(hostedIdSchema).optional(),
            priority: z.enum(hostedTaskPriorities).optional(),
            status: z.enum(hostedTaskStatuses).optional(),
        })
        .refine((patch) => Object.keys(patch).length > 0, 'Provide at least one task field.'),
});

export const hostedTaskMutationSchema = z
    .object({
        eventCursor: z
            .string()
            .regex(/^[1-9]\d*$/u)
            .nullable(),
        task: hostedMessageTaskSchema,
    })
    .strict();

export const hostedTaskLabelListInputSchema = z.object({ serverId: hostedIdSchema }).strict();
export const hostedTaskLabelListSchema = z.array(hostedTaskLabelSchema);
export const hostedTaskLabelCreateInputSchema = z
    .object({
        name: z.string().trim().min(1).max(80),
        serverId: hostedIdSchema,
    })
    .strict();
export const hostedTaskLabelUpdateInputSchema = z
    .object({
        color: z.enum(hostedTaskLabelColors).optional(),
        labelId: hostedIdSchema,
        name: z.string().trim().min(1).max(80).optional(),
        serverId: hostedIdSchema,
    })
    .strict();
export const hostedTaskLabelDeleteInputSchema = z
    .object({ labelId: hostedIdSchema, serverId: hostedIdSchema })
    .strict();
export const hostedTaskLabelMutationSchema = z
    .object({
        eventCursor: z.string().regex(/^[1-9]\d*$/u),
        label: hostedTaskLabelSchema.nullable(),
    })
    .strict();

export type HostedTaskListItem = z.infer<typeof hostedTaskListItemSchema>;
export type HostedTaskAssignee = z.infer<typeof hostedTaskAssigneeSchema>;
