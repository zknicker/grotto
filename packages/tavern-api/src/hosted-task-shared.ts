import * as z from 'zod';

const hostedTaskIdSchema = z.string().trim().min(1);

export const hostedTaskStatuses = ['todo', 'in_progress', 'in_review', 'done', 'closed'] as const;
export const hostedTaskPriorities = ['none', 'urgent', 'high', 'medium', 'low'] as const;
export const hostedTaskLabelColors = [
    'red',
    'orange',
    'amber',
    'green',
    'teal',
    'blue',
    'purple',
    'pink',
    'gray',
] as const;

export const hostedTaskLabelSchema = z
    .object({
        color: z.enum(hostedTaskLabelColors),
        id: hostedTaskIdSchema,
        name: z.string().trim().min(1).max(80),
    })
    .strict();

export const hostedMessageTaskSchema = z
    .object({
        assigneeAgentId: hostedTaskIdSchema.nullable(),
        assigneeUserId: hostedTaskIdSchema.nullable(),
        chatId: hostedTaskIdSchema,
        claimedAt: z.iso.datetime({ offset: true }).nullable(),
        createdAt: z.iso.datetime({ offset: true }),
        createdByAgentId: hostedTaskIdSchema.nullable(),
        createdByUserId: hostedTaskIdSchema.nullable(),
        labels: z.array(hostedTaskLabelSchema),
        messageId: hostedTaskIdSchema,
        number: z.number().int().positive(),
        origin: z.enum(['composed', 'converted']),
        priority: z.enum(hostedTaskPriorities),
        status: z.enum(hostedTaskStatuses),
        threadChatId: hostedTaskIdSchema,
        updatedAt: z.iso.datetime({ offset: true }),
        version: z.number().int().positive(),
    })
    .strict();

export type HostedMessageTask = z.infer<typeof hostedMessageTaskSchema>;
export type HostedTaskLabel = z.infer<typeof hostedTaskLabelSchema>;
