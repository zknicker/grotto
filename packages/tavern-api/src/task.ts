import * as z from 'zod';
import { chatMessageSchema, idSchema, threadSummarySchema } from './chat.ts';
import {
    messageTaskSchema,
    taskLabelColors,
    taskLabelSchema,
    taskPriorities,
    taskStatuses,
} from './task-shared.ts';

export const taskListInputSchema = z
    .object({
        chatId: idSchema.optional(),
        serverId: idSchema,
    })
    .strict();

export const taskListItemSchema = z
    .object({
        chatKind: z.enum(['channel', 'dm']),
        chatName: z.string().nullable(),
        chatPeerUserId: idSchema.nullable(),
        message: chatMessageSchema,
        task: messageTaskSchema,
        threadSummary: threadSummarySchema,
    })
    .strict();

export const taskListSchema = z.array(taskListItemSchema);

export const taskAssigneesInputSchema = z
    .object({
        messageId: idSchema,
        serverId: idSchema,
    })
    .strict();

/**
 * Who a task may be handed to. Agents and humans are both first-class
 * assignees; the tagged shape keeps "both set" unrepresentable rather than
 * validated after the fact.
 */
export const taskAssigneeSchema = z.discriminatedUnion('kind', [
    z
        .object({
            agentId: idSchema,
            avatarUrl: z.string().nullable(),
            displayName: z.string(),
            handle: z.string(),
            kind: z.literal('agent'),
        })
        .strict(),
    z
        .object({
            kind: z.literal('human'),
            role: z.enum(['admin', 'member', 'owner']),
            userId: idSchema,
        })
        .strict(),
]);

/** The assignee a mutation names, without the presentation fields. */
export const taskAssigneeRefSchema = z.discriminatedUnion('kind', [
    z.object({ agentId: idSchema, kind: z.literal('agent') }).strict(),
    z.object({ kind: z.literal('human'), userId: idSchema }).strict(),
]);

export const taskAssigneesSchema = z.array(taskAssigneeSchema);

export const taskPromoteInputSchema = z
    .object({
        messageId: idSchema,
        serverId: idSchema,
    })
    .strict();

export const taskPromotionSchema = z
    .object({
        idempotent: z.boolean(),
        task: messageTaskSchema,
    })
    .strict();

export const taskCreateInputSchema = z
    .object({
        assigneeUserId: idSchema.optional(),
        chatId: idSchema,
        content: z.string().trim().min(1).max(32_000),
        nonce: z.string().trim().min(1).max(128),
        serverId: idSchema,
    })
    .strict();

export const taskMutationInputSchema = z
    .object({
        expectedVersion: z.number().int().positive(),
        messageId: idSchema,
        serverId: idSchema,
    })
    .strict();

export const taskAssignInputSchema = taskMutationInputSchema.extend({
    assignee: taskAssigneeRefSchema.nullable(),
});

export const taskUpdateInputSchema = taskMutationInputSchema.extend({
    patch: z
        .object({
            labelIds: z.array(idSchema).optional(),
            priority: z.enum(taskPriorities).optional(),
            status: z.enum(taskStatuses).optional(),
        })
        .refine((patch) => Object.keys(patch).length > 0, 'Provide at least one task field.'),
});

export const taskMutationSchema = z
    .object({
        eventCursor: z
            .string()
            .regex(/^[1-9]\d*$/u)
            .nullable(),
        task: messageTaskSchema,
    })
    .strict();

export const taskLabelListInputSchema = z.object({ serverId: idSchema }).strict();
export const taskLabelListSchema = z.array(taskLabelSchema);
export const taskLabelCreateInputSchema = z
    .object({
        name: z.string().trim().min(1).max(80),
        serverId: idSchema,
    })
    .strict();
export const taskLabelUpdateInputSchema = z
    .object({
        color: z.enum(taskLabelColors).optional(),
        labelId: idSchema,
        name: z.string().trim().min(1).max(80).optional(),
        serverId: idSchema,
    })
    .strict();
export const taskLabelDeleteInputSchema = z
    .object({ labelId: idSchema, serverId: idSchema })
    .strict();
export const taskLabelMutationSchema = z
    .object({
        eventCursor: z.string().regex(/^[1-9]\d*$/u),
        label: taskLabelSchema.nullable(),
    })
    .strict();

export type TaskListItem = z.infer<typeof taskListItemSchema>;
export type TaskAssignee = z.infer<typeof taskAssigneeSchema>;
