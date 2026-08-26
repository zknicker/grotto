import * as z from 'zod';
import { agentReasoningEffortSchema } from './agent-execution.ts';
import { avatarBytesInputSchema, avatarMaxBytes, avatarMediaTypeSchema } from './avatar.ts';

const idSchema = z.string().trim().min(1).max(200);
const timestampSchema = z.iso.datetime({ offset: true });
export const preparedActionStatusSchema = z.enum(['executed', 'pending', 'superseded']);

export type PreparedActionStatus = z.infer<typeof preparedActionStatusSchema>;

export const preparedActionMediaSchema = z
    .object({
        byteSize: z.number().int().positive().max(avatarMaxBytes),
        id: z.string().regex(/^pam_[A-Za-z0-9_-]{16}$/u),
        mediaType: avatarMediaTypeSchema,
        sha256: z.string().regex(/^[a-f0-9]{64}$/u),
        url: z.string().min(1),
    })
    .strict();

export type PreparedActionMedia = z.infer<typeof preparedActionMediaSchema>;

const computerGuidanceSchema = z
    .discriminatedUnion('kind', [
        z
            .object({
                computerId: idSchema,
                kind: z.literal('required'),
                label: z.string().trim().min(1).max(100).nullable().optional(),
            })
            .strict(),
        z
            .object({
                computerId: idSchema,
                kind: z.literal('suggested'),
                label: z.string().trim().min(1).max(100).nullable().optional(),
            })
            .strict(),
    ])
    .nullable();

export type PreparedActionComputerGuidance = z.infer<typeof computerGuidanceSchema>;

export const agentCreateActionInputSchema = z
    .object({
        computer: computerGuidanceSchema.default(null),
        description: z.string().trim().max(500).nullable().default(null),
        draftHint: z.string().trim().max(1000).nullable().default(null),
        kind: z.literal('agent:create'),
        name: z.string().trim().min(1).max(80),
    })
    .strict();

export type AgentCreateActionInput = z.infer<typeof agentCreateActionInputSchema>;

/** The stdin contract for `grotto action prepare`; v1 intentionally has one kind. */
export const actionCardActionSchema = z.discriminatedUnion('kind', [agentCreateActionInputSchema]);

export type ActionCardAction = z.infer<typeof actionCardActionSchema>;

export const agentCreateActionResultSchema = z
    .object({
        agentId: idSchema,
        avatarUrl: z.string().nullable(),
        chatId: idSchema,
        computerId: idSchema,
        description: z.string().max(500).nullable(),
        displayName: z.string().trim().min(1).max(80),
        handle: z.string().trim().min(1).max(31),
        modelId: z.string().trim().min(1).max(128),
        reasoningEffort: agentReasoningEffortSchema,
        role: z.literal('member'),
        runtimeId: z.string().trim().min(1).max(64),
    })
    .strict();

export type AgentCreateActionResult = z.infer<typeof agentCreateActionResultSchema>;

const preparedActionBaseSchema = z
    .object({
        chatId: idSchema,
        createdAt: timestampSchema,
        executedAt: timestampSchema.nullable(),
        executedByUserId: idSchema.nullable(),
        id: z.string().regex(/^act_[A-Za-z0-9_-]{16}$/u),
        messageId: idSchema,
        proposerAgentId: idSchema,
        status: preparedActionStatusSchema,
        supersededAt: timestampSchema.nullable(),
        supersededByActionId: z
            .string()
            .regex(/^act_[A-Za-z0-9_-]{16}$/u)
            .nullable(),
        result: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .strict();

const agentCreatePreparedActionSchema = preparedActionBaseSchema
    .extend({
        kind: z.literal('agent:create'),
        proposal: agentCreateActionInputSchema.extend({
            avatar: preparedActionMediaSchema,
        }),
        result: agentCreateActionResultSchema.strict().nullable().optional(),
    })
    .strict();

/** Future action kinds remain data-only and can never acquire a renderer by accident. */
const unknownPreparedActionSchema = preparedActionBaseSchema
    .extend({
        kind: z
            .string()
            .trim()
            .min(1)
            .refine((kind) => kind !== 'agent:create'),
        proposal: z.record(z.string(), z.unknown()),
        result: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .strict();

export const preparedActionSchema = z.union([
    agentCreatePreparedActionSchema,
    unknownPreparedActionSchema,
]);

export type AgentCreatePreparedAction = z.infer<typeof agentCreatePreparedActionSchema>;
export type UnknownPreparedAction = z.infer<typeof unknownPreparedActionSchema>;
export type PreparedAction = z.infer<typeof preparedActionSchema>;

const actionAvatarInputSchema = avatarBytesInputSchema;

export const agentActionPrepareInputSchema = z
    .object({
        action: actionCardActionSchema,
        avatar: actionAvatarInputSchema,
        nonce: z.string().trim().min(1).max(128),
        target: z.string().trim().min(1).max(200),
    })
    .strict();

export type AgentActionPrepareInput = z.infer<typeof agentActionPrepareInputSchema>;

export const agentActionPrepareReceiptSchema = z
    .object({
        action: preparedActionSchema,
        chatId: idSchema,
        idempotent: z.boolean(),
        messageId: idSchema,
        sequence: z.number().int().positive(),
        target: z.string().trim().min(1),
    })
    .strict();

export type AgentActionPrepareReceipt = z.infer<typeof agentActionPrepareReceiptSchema>;

export function isAgentCreatePreparedAction(
    action: PreparedAction
): action is AgentCreatePreparedAction {
    return action.kind === 'agent:create';
}
