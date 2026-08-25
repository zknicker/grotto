import * as z from 'zod';
import { idSchema } from './chat.ts';

export const mentionOptionsInputSchema = z
    .object({
        agentIds: z.array(idSchema).max(100).default([]),
        chatId: idSchema,
        serverId: idSchema,
    })
    .strict();

export const mentionOptionSchema = z
    .object({
        description: z.string().nullable(),
        id: z.string().min(1),
        insertText: z.string().min(1),
        kind: z.enum(['agent', 'skill']),
        label: z.string().min(1),
        projection: z.enum(['agent-reference', 'skill-activation']),
        sourceLabel: z.enum(['Agents', 'Skills']),
    })
    .strict();

export type MentionOption = z.infer<typeof mentionOptionSchema>;

export const mentionOptionsSchema = z
    .object({ options: z.array(mentionOptionSchema).max(1000) })
    .strict();
