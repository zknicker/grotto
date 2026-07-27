import * as z from 'zod';
import { hostedIdSchema } from './hosted-chat.ts';

const hostedTimestampSchema = z.iso.datetime({ offset: true });

/**
 * The Server→Computer typed launch command. It carries only identity, the
 * resolved runtime/model to run, the durable collaboration chat the launch
 * answers, and the composed turn prompt. It never carries a Server-valid
 * credential: the Computer mints its own scoped runner authority (below).
 */
export const hostedAgentStartCommandSchema = z
    .object({
        agentId: hostedIdSchema,
        chatId: hostedIdSchema,
        modelId: z.string().trim().min(1).max(128),
        prompt: z.string().max(200_000),
        runId: hostedIdSchema,
        runtimeId: z.string().trim().min(1).max(64),
        type: z.literal('start'),
    })
    .strict();

export type HostedAgentStartCommand = z.infer<typeof hostedAgentStartCommandSchema>;

/**
 * A Computer mints a per-launch runner credential from its Computer credential
 * before spawning the Agent. The credential is scoped to exactly one Agent,
 * run, and collaboration chat, so a leaked runner token can only speak as that
 * Agent into that one launch's channel.
 */
export const hostedRunnerMintRequestSchema = z
    .object({
        agentId: hostedIdSchema,
        chatId: hostedIdSchema,
        credentialHash: z.string().regex(/^[a-f0-9]{64}$/u),
        runId: hostedIdSchema,
    })
    .strict();

export type HostedRunnerMintRequest = z.infer<typeof hostedRunnerMintRequestSchema>;

export const hostedRunnerTokenSchema = z.string().regex(/^grtr_[A-Za-z0-9_-]{43}$/u);

export const hostedRunnerMintResponseSchema = z
    .object({ runnerId: hostedIdSchema, runnerToken: hostedRunnerTokenSchema })
    .strict();

export type HostedRunnerMintResponse = z.infer<typeof hostedRunnerMintResponseSchema>;

export const hostedRunnerRevokeRequestSchema = z
    .object({
        credentialHash: z.string().regex(/^[a-f0-9]{64}$/u),
        runnerId: hostedIdSchema,
    })
    .strict();

export type HostedRunnerRevokeRequest = z.infer<typeof hostedRunnerRevokeRequestSchema>;

/**
 * `grotto message send` behind the loopback proxy. The runner credential fixes
 * the author and channel, so the Agent supplies only the message body plus the
 * grammar target it believes it is answering; the Server writes to the runner's
 * bound chat and records the requested target for fidelity.
 */
export const hostedAgentSendInputSchema = z
    .object({
        content: z.string().trim().min(1).max(32_000),
        nonce: z.string().trim().min(1).max(128),
        target: z.string().trim().min(1).max(200),
    })
    .strict();

export type HostedAgentSendInput = z.infer<typeof hostedAgentSendInputSchema>;

export const hostedAgentSendReceiptSchema = z
    .object({
        chatId: hostedIdSchema,
        idempotent: z.boolean(),
        messageId: hostedIdSchema,
        sequence: z.number().int().positive(),
        target: z.string(),
    })
    .strict();

export type HostedAgentSendReceipt = z.infer<typeof hostedAgentSendReceiptSchema>;

/**
 * The compact turn summary a Computer pushes after a launch settles. Durable
 * collaboration and this compact activity live Server-side; the raw transcript,
 * logs, and workspace stay Computer-local behind the authorized live relay.
 */
export const hostedAgentTurnStatusSchema = z.enum(['completed', 'failed']);

export const hostedAgentTurnSummarySchema = z
    .object({
        agentId: hostedIdSchema,
        endedAt: hostedTimestampSchema,
        messageCount: z.number().int().nonnegative().max(10_000),
        runId: hostedIdSchema,
        startedAt: hostedTimestampSchema,
        status: hostedAgentTurnStatusSchema,
        summary: z.string().max(2000),
        type: z.literal('turn'),
    })
    .strict();

export type HostedAgentTurnSummary = z.infer<typeof hostedAgentTurnSummarySchema>;
