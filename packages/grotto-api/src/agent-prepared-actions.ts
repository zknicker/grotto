import * as z from 'zod';
import { agentCreatedSchema, agentHandleSchema } from './agent.ts';
import { agentReasoningEffortSchema } from './agent-execution.ts';
import { avatarBytesInputSchema } from './avatar.ts';
import { idSchema } from './chat.ts';
import { preparedActionSchema } from './prepared-actions.ts';

const actionIdSchema = z.string().regex(/^act_[A-Za-z0-9_-]{16}$/u);

/** The human-owned values submitted after reviewing one immutable proposal. */
export const preparedActionCommitInputSchema = z
    .object({
        actionId: actionIdSchema,
        avatar: avatarBytesInputSchema.optional(),
        computerId: idSchema,
        description: z.string().trim().max(500).nullable().default(null),
        displayName: z.string().trim().min(1).max(80),
        handle: agentHandleSchema,
        modelId: z.string().trim().min(1).max(128),
        reasoningEffort: agentReasoningEffortSchema.default('medium'),
        runtimeId: z.string().trim().min(1).max(64),
        serverId: idSchema,
    })
    .strict();

export type PreparedActionCommitInput = z.infer<typeof preparedActionCommitInputSchema>;

export const preparedActionCommitResultSchema = z
    .object({
        action: preparedActionSchema,
        agent: agentCreatedSchema.shape.agent,
        idempotent: z.boolean(),
    })
    .strict();

export type PreparedActionCommitResult = z.infer<typeof preparedActionCommitResultSchema>;
