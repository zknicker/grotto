import * as z from 'zod';
import { hostedIdSchema } from './hosted-chat.ts';

export const hostedMentionOptionsInputSchema = z
    .object({
        agentIds: z.array(hostedIdSchema).max(100).default([]),
        chatId: hostedIdSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedMentionOptionSchema = z
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

export type HostedMentionOption = z.infer<typeof hostedMentionOptionSchema>;

export const hostedMentionOptionsSchema = z
    .object({ options: z.array(hostedMentionOptionSchema).max(1000) })
    .strict();
