import * as z from 'zod';

const taskIdSchema = z.string().trim().min(1);

export const taskStatuses = ['todo', 'in_progress', 'in_review', 'done', 'closed'] as const;
export const taskPriorities = ['none', 'urgent', 'high', 'medium', 'low'] as const;
export const taskLabelColors = [
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

export const taskLabelSchema = z
    .object({
        color: z.enum(taskLabelColors),
        id: taskIdSchema,
        name: z.string().trim().min(1).max(80),
    })
    .strict();

export const messageTaskSchema = z
    .object({
        assigneeAgentId: taskIdSchema.nullable(),
        assigneeUserId: taskIdSchema.nullable(),
        chatId: taskIdSchema,
        claimedAt: z.iso.datetime({ offset: true }).nullable(),
        createdAt: z.iso.datetime({ offset: true }),
        createdByAgentId: taskIdSchema.nullable(),
        createdByUserId: taskIdSchema.nullable(),
        labels: z.array(taskLabelSchema),
        messageId: taskIdSchema,
        number: z.number().int().positive(),
        origin: z.enum(['composed', 'converted']),
        priority: z.enum(taskPriorities),
        status: z.enum(taskStatuses),
        threadChatId: taskIdSchema,
        updatedAt: z.iso.datetime({ offset: true }),
        version: z.number().int().positive(),
    })
    .strict();

export type MessageTask = z.infer<typeof messageTaskSchema>;
export type TaskLabel = z.infer<typeof taskLabelSchema>;

/**
 * An `in_review` task whose thread has been quiet this long is closed as stale
 * by Server. Closing is reversible; a human can reopen it.
 */
export const TASK_IN_REVIEW_STALE_DAYS = 7;
