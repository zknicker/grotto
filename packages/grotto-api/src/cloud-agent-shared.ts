import * as z from 'zod';

const cloudAgentIdSchema = z.string().trim().min(1);
const cloudAgentTimestampSchema = z.iso.datetime({ offset: true });

export const cloudAgentTitleMaxLength = 120;
export const cloudAgentActivityMaxLength = 120;
export const cloudAgentSummaryMaxLength = 2000;
export const cloudAgentRunsRetained = 20;

/** Cursor is the only provider; a second one needs a real per-execution choice. */
export const cloudAgentProviders = ['cursor'] as const;

export const cloudAgentProviderSchema = z.enum(cloudAgentProviders);

export const cloudAgentStatuses = [
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled',
    'expired',
] as const;

export const cloudAgentStatusSchema = z.enum(cloudAgentStatuses);

export const cloudAgentTerminalStatuses = ['completed', 'failed', 'cancelled', 'expired'] as const;

export function isTerminalCloudAgentStatus(status: CloudAgentStatus): boolean {
    return (cloudAgentTerminalStatuses as readonly string[]).includes(status);
}

/** `owner/name`, the only repository shape Grotto records. There is no registry. */
export const cloudAgentRepositorySchema = z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u, 'A repository reads as owner/name.');

export const cloudAgentRefSchema = z.string().trim().min(1).max(200);

export const cloudAgentTitleSchema = z.string().trim().min(1).max(cloudAgentTitleMaxLength);

/** One bounded line of current state, never a transcript. */
export const cloudAgentActivitySchema = z
    .object({
        at: cloudAgentTimestampSchema,
        summary: z.string().trim().min(1).max(cloudAgentActivityMaxLength),
    })
    .strict();

/**
 * Cursor's own terminal Run report, retained as evidence. Grotto stores no
 * branch or pull-request entity and claims no GitHub lifecycle.
 */
export const cloudAgentBranchSchema = z
    .object({
        branch: z.string().trim().min(1).max(300),
        pullRequestUrl: z.url().max(2000).nullable(),
        repository: cloudAgentRepositorySchema,
    })
    .strict();

export const cloudAgentUsageSchema = z
    .object({
        costUsd: z.number().nonnegative().nullable(),
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
    })
    .strict();

/** Who asked for cancellation. Humans and the delegating Agent may both ask. */
export const cloudAgentCancelRequestedBySchema = z.discriminatedUnion('kind', [
    z.object({ id: cloudAgentIdSchema, kind: z.literal('agent') }).strict(),
    z.object({ id: cloudAgentIdSchema, kind: z.literal('user') }).strict(),
]);

/** One provider Run inside a work record. Newest first, and bounded. */
export const cloudAgentRunSchema = z
    .object({
        branches: z.array(cloudAgentBranchSchema).max(50),
        errorCode: z.string().trim().min(1).max(120).nullable(),
        providerRunId: z.string().trim().min(1).max(200).nullable(),
        rawStatus: z.string().trim().min(1).max(120).nullable(),
        runId: cloudAgentIdSchema,
        startedAt: cloudAgentTimestampSchema.nullable(),
        status: cloudAgentStatusSchema,
        summary: z.string().trim().min(1).max(cloudAgentSummaryMaxLength).nullable(),
        terminalAt: cloudAgentTimestampSchema.nullable(),
        usage: cloudAgentUsageSchema.nullable(),
    })
    .strict();

/**
 * The durable record one Cloud Agent work Message anchors. The Message owns
 * authorship and Chat placement; this record owns execution state. It stores
 * provider-safe identifiers and bounded state only — prompts, credentials, raw
 * transcripts, and hosted workspace files never reach Server.
 */
export const cloudAgentWorkSchema = z
    .object({
        activity: cloudAgentActivitySchema.nullable(),
        agentId: cloudAgentIdSchema,
        cancelRequestedAt: cloudAgentTimestampSchema.nullable(),
        cancelRequestedBy: cloudAgentCancelRequestedBySchema.nullable(),
        chatId: cloudAgentIdSchema,
        computerId: cloudAgentIdSchema,
        createdAt: cloudAgentTimestampSchema,
        id: cloudAgentIdSchema,
        messageId: cloudAgentIdSchema,
        provider: cloudAgentProviderSchema,
        providerAgentId: z.string().trim().min(1).max(200).nullable(),
        providerUrl: z.url().max(2000).nullable(),
        repository: cloudAgentRepositorySchema,
        runs: z.array(cloudAgentRunSchema).max(cloudAgentRunsRetained),
        startedAt: cloudAgentTimestampSchema.nullable(),
        startingRef: cloudAgentRefSchema.nullable(),
        status: cloudAgentStatusSchema,
        terminalAt: cloudAgentTimestampSchema.nullable(),
        title: cloudAgentTitleSchema,
        updatedAt: cloudAgentTimestampSchema,
    })
    .strict();

export type CloudAgentBranch = z.infer<typeof cloudAgentBranchSchema>;
export type CloudAgentCancelRequestedBy = z.infer<typeof cloudAgentCancelRequestedBySchema>;
export type CloudAgentProvider = z.infer<typeof cloudAgentProviderSchema>;
export type CloudAgentRun = z.infer<typeof cloudAgentRunSchema>;
export type CloudAgentStatus = z.infer<typeof cloudAgentStatusSchema>;
export type CloudAgentUsage = z.infer<typeof cloudAgentUsageSchema>;
export type CloudAgentWork = z.infer<typeof cloudAgentWorkSchema>;

/**
 * The envelope suffix every surface that prints a Message appends after the
 * task and Ask suffixes, from this one formatting owner
 * (specs/grotto-cli.md#4-envelopes-and-message-lines).
 */
export function formatCloudAgentWorkSuffix(work: {
    status: CloudAgentStatus;
    title: string;
}): string {
    return ` [cloud-agent-work status=${work.status} title=${work.title}]`;
}
