import * as z from 'zod';
import { hostedIdSchema } from './hosted-chat.ts';
import { hostedMessageTaskSchema } from './hosted-task-shared.ts';
import {
    agentArchetypeIdSchema,
    agentRuntimeBrowserActionResultSchema,
    agentRuntimeBrowserSettingsSchema,
    agentRuntimeSaveBrowserSettingsSchema,
} from './runtime/contracts.ts';

const hostedTimestampSchema = z.iso.datetime({ offset: true });

/** One Server-owned message envelope durably accepted into a Computer inbox. */
export const hostedAgentInboxItemSchema = z
    .object({
        chatId: hostedIdSchema,
        content: z.string().max(32_000),
        createdAt: hostedTimestampSchema,
        id: hostedIdSchema,
        mentioned: z.boolean().optional(),
        senderDescription: z.string().trim().max(500).optional(),
        senderHandle: z.string().trim().min(1).max(128),
        senderType: z.enum(['agent', 'human', 'system']),
        sequence: z.number().int().positive(),
        task: hostedMessageTaskSchema.optional(),
        target: z.string().trim().min(1).max(200),
    })
    .strict();

export type HostedAgentInboxItem = z.infer<typeof hostedAgentInboxItemSchema>;

/**
 * The Server→Computer typed launch command. It carries only identity, the
 * resolved runtime/model to run, and structured durable inbox envelopes. The
 * Computer owns the model-visible projection. It never carries a Server-valid
 * credential: the Computer mints its own scoped runner authority (below).
 */
export const hostedAgentStartCommandSchema = z
    .object({
        agentId: hostedIdSchema,
        agentDescription: z.string().max(10_000).optional(),
        agentName: z.string().trim().min(1).max(64).optional(),
        chatId: hostedIdSchema,
        homeTimezone: z.string().trim().min(1).max(128).optional(),
        inbox: z.array(hostedAgentInboxItemSchema).max(100).default([]),
        modelId: z.string().trim().min(1).max(128),
        runId: hostedIdSchema,
        runtimeId: z.string().trim().min(1).max(64),
        sessionGeneration: z.number().int().positive(),
        type: z.literal('start'),
        webAccess: z.enum(['fetch-only', 'search', 'search-only']).optional(),
    })
    .strict();

export type HostedAgentStartCommand = z.infer<typeof hostedAgentStartCommandSchema>;

/**
 * Terminates the named in-flight run on the Computer. A human Stop persists
 * Server-side and rides this frame down to kill the live turn; the Computer
 * kills the run's child process and reports nothing model-visible.
 */
export const hostedAgentStopCommandSchema = z
    .object({
        agentId: hostedIdSchema,
        runId: hostedIdSchema,
        type: z.literal('stop'),
    })
    .strict();

export type HostedAgentStopCommand = z.infer<typeof hostedAgentStopCommandSchema>;

export const hostedAgentResetCommandSchema = z
    .object({
        agentId: hostedIdSchema,
        kind: z.enum(['full', 'session']),
        sessionGeneration: z.number().int().positive(),
        type: z.literal('agent-reset'),
    })
    .strict();

export type HostedAgentResetCommand = z.infer<typeof hostedAgentResetCommandSchema>;

/** Retires one Agent and erases only that Agent's Computer-local execution state. */
export const hostedAgentRetireCommandSchema = z
    .object({
        agentId: hostedIdSchema,
        type: z.literal('agent-retire'),
    })
    .strict();

export type HostedAgentRetireCommand = z.infer<typeof hostedAgentRetireCommandSchema>;

/** Full desired executor snapshot applied by the assigned Computer. */
export const hostedAgentConfigureCommandSchema = z
    .object({
        agentDescription: z.string().trim().min(1).max(500).nullable(),
        agentId: hostedIdSchema,
        agentName: z.string().trim().min(1).max(80),
        archetype: agentArchetypeIdSchema.nullable(),
        modelId: z.string().trim().min(1).max(128),
        runtimeId: z.string().trim().min(1).max(64),
        sessionGeneration: z.number().int().positive(),
        sessionResetKind: z.enum(['full', 'session']),
        type: z.literal('agent-configure'),
    })
    .strict();

export type HostedAgentConfigureCommand = z.infer<typeof hostedAgentConfigureCommandSchema>;

export const hostedAgentSkillImportCommandSchema = z
    .object({
        agentId: hostedIdSchema,
        requestId: hostedIdSchema,
        sourceId: hostedIdSchema,
        type: z.literal('agent-skill-import'),
    })
    .strict();

export type HostedAgentSkillImportCommand = z.infer<typeof hostedAgentSkillImportCommandSchema>;

const hostedAgentSkillNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u);
const hostedAgentSkillHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const hostedAgentSkillFileSchema = z
    .object({
        content: z.string().max(2 * 1024 * 1024),
        hash: hostedAgentSkillHashSchema,
        name: hostedAgentSkillNameSchema,
        updatedAt: hostedTimestampSchema,
    })
    .strict();

export type HostedAgentSkillFile = z.infer<typeof hostedAgentSkillFileSchema>;

export const hostedAgentSkillFileRequestSchema = z
    .object({
        agentId: hostedIdSchema,
        operation: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('read'), name: hostedAgentSkillNameSchema }).strict(),
            z
                .object({
                    content: z.string().max(2 * 1024 * 1024),
                    expectedHash: hostedAgentSkillHashSchema,
                    kind: z.literal('update'),
                    name: hostedAgentSkillNameSchema,
                })
                .strict(),
            z
                .object({
                    expectedHash: hostedAgentSkillHashSchema,
                    kind: z.literal('delete'),
                    name: hostedAgentSkillNameSchema,
                })
                .strict(),
        ]),
        requestId: hostedIdSchema,
        type: z.literal('agent-skill-file-request'),
    })
    .strict();

export type HostedAgentSkillFileRequest = z.infer<typeof hostedAgentSkillFileRequestSchema>;

/** Runs one persisted reminder script inside the owning Agent's Computer workspace. */
export const hostedReminderScriptCommandSchema = z
    .object({
        agentId: hostedIdSchema,
        attentionId: hostedIdSchema,
        fireId: hostedIdSchema,
        reminderId: hostedIdSchema,
        script: z.string().min(1).max(16_384),
        type: z.literal('reminder-script'),
    })
    .strict();

export type HostedReminderScriptCommand = z.infer<typeof hostedReminderScriptCommandSchema>;

/**
 * Work landed for a busy Agent. The full envelopes are accepted into the
 * Computer's durable inbox; only their content-free metadata projection is
 * injected into the live model turn.
 */
export const hostedAgentNoticeCommandSchema = z
    .object({
        agentId: hostedIdSchema,
        inbox: z.array(hostedAgentInboxItemSchema).min(1).max(100),
        runId: hostedIdSchema,
        totalPending: z.number().int().positive(),
        type: z.literal('notice'),
    })
    .strict();

export type HostedAgentNoticeCommand = z.infer<typeof hostedAgentNoticeCommandSchema>;

/** Best-effort instruction to erase this Server attachment's Computer-local state. */
export const hostedServerDeleteCommandSchema = z
    .object({
        type: z.literal('server-delete'),
    })
    .strict();

export type HostedServerDeleteCommand = z.infer<typeof hostedServerDeleteCommandSchema>;

export const hostedWorkspacePathSchema = z
    .string()
    .trim()
    .max(2000)
    .refine((value) => value.length === 0 || !value.startsWith('/'), {
        message: 'Workspace path must be relative.',
    })
    .refine((value) => !value.includes('\\'), {
        message: 'Workspace path must use forward slashes.',
    })
    .refine(
        (value) =>
            value.length === 0 ||
            value
                .split('/')
                .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
        { message: 'Workspace path must stay inside the workspace.' }
    );

export const hostedWorkspaceFileEntrySchema = z
    .object({
        kind: z.enum(['directory', 'file']),
        mediaType: z.string().trim().min(1).nullable(),
        name: z.string().trim().min(1),
        path: hostedWorkspacePathSchema.refine((value) => value.length > 0),
        sizeBytes: z.number().int().nonnegative().nullable(),
        updatedAt: hostedTimestampSchema.nullable(),
    })
    .strict();

export type HostedWorkspaceFileEntry = z.infer<typeof hostedWorkspaceFileEntrySchema>;

export const hostedWorkspaceFileListSchema = z
    .object({
        entries: z.array(hostedWorkspaceFileEntrySchema).max(10_000),
        path: hostedWorkspacePathSchema,
        workspaceRoot: z.string().trim().min(1).max(4000),
    })
    .strict();

export type HostedWorkspaceFileList = z.infer<typeof hostedWorkspaceFileListSchema>;

export const hostedWorkspaceFileContentSchema = z
    .object({
        binary: z.boolean(),
        content: z.string(),
        encoding: z.enum(['base64', 'utf8']),
        language: z.string().trim().min(1).nullable(),
        mediaType: z.string().trim().min(1),
        path: hostedWorkspacePathSchema.refine((value) => value.length > 0),
        sizeBytes: z.number().int().nonnegative(),
        truncated: z.boolean(),
        updatedAt: hostedTimestampSchema.nullable(),
        workspaceRoot: z.string().trim().min(1).max(4000),
    })
    .strict();

export type HostedWorkspaceFileContent = z.infer<typeof hostedWorkspaceFileContentSchema>;

export const hostedAgentWorkspaceRequestSchema = z
    .object({
        agentId: hostedIdSchema,
        operation: z.discriminatedUnion('kind', [
            z
                .object({
                    includeHidden: z.boolean().optional().default(false),
                    kind: z.literal('list'),
                    path: hostedWorkspacePathSchema,
                })
                .strict(),
            z
                .object({
                    includeHidden: z.boolean().optional().default(false),
                    kind: z.literal('read'),
                    path: hostedWorkspacePathSchema.refine((value) => value.length > 0),
                })
                .strict(),
        ]),
        requestId: hostedIdSchema,
        type: z.literal('agent-workspace-request'),
    })
    .strict();

export type HostedAgentWorkspaceRequest = z.infer<typeof hostedAgentWorkspaceRequestSchema>;

/**
 * One authenticated Server request against the Browser service owned by this
 * Computer attachment. Browser settings and lifecycle never bypass the
 * Server or expose the Computer socket to the App.
 */
export const hostedBrowserRequestSchema = z
    .object({
        operation: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('get') }).strict(),
            z
                .object({
                    input: agentRuntimeSaveBrowserSettingsSchema,
                    kind: z.literal('save'),
                })
                .strict(),
            z.object({ kind: z.literal('open') }).strict(),
            z.object({ kind: z.literal('restart') }).strict(),
        ]),
        requestId: hostedIdSchema,
        type: z.literal('browser-request'),
    })
    .strict();

export type HostedBrowserRequest = z.infer<typeof hostedBrowserRequestSchema>;

/** Every typed frame the Server sends down a Computer attachment socket. */
export const hostedAgentCommandSchema = z.discriminatedUnion('type', [
    hostedAgentStartCommandSchema,
    hostedAgentStopCommandSchema,
    hostedAgentResetCommandSchema,
    hostedAgentRetireCommandSchema,
    hostedAgentConfigureCommandSchema,
    hostedAgentSkillImportCommandSchema,
    hostedAgentSkillFileRequestSchema,
    hostedAgentWorkspaceRequestSchema,
    hostedBrowserRequestSchema,
    hostedReminderScriptCommandSchema,
    hostedAgentNoticeCommandSchema,
    hostedServerDeleteCommandSchema,
]);

export type HostedAgentCommand = z.infer<typeof hostedAgentCommandSchema>;

export const hostedBrowserResultSchema = z
    .object({
        error: z.string().trim().min(1).max(500).optional(),
        requestId: hostedIdSchema,
        result: z
            .discriminatedUnion('kind', [
                z
                    .object({
                        kind: z.literal('settings'),
                        value: agentRuntimeBrowserSettingsSchema,
                    })
                    .strict(),
                z
                    .object({
                        kind: z.literal('action'),
                        value: agentRuntimeBrowserActionResultSchema,
                    })
                    .strict(),
            ])
            .optional(),
        type: z.literal('browser-result'),
    })
    .strict()
    .refine((value) => Boolean(value.error) !== Boolean(value.result));

export type HostedBrowserResult = z.infer<typeof hostedBrowserResultSchema>;

/**
 * The Computer's local-acceptance acknowledgement for a start command. An ack
 * means the Computer durably accepted the delivery, not that a model has seen
 * the work: it lets the Server stop retrying the delivery while the turn runs.
 */
export const hostedAgentDeliveryAckSchema = z
    .object({
        agentId: hostedIdSchema,
        runId: hostedIdSchema,
        type: z.literal('ack'),
    })
    .strict();

export type HostedAgentDeliveryAck = z.infer<typeof hostedAgentDeliveryAckSchema>;

/** Idempotent Computer result for one reminder script attention row. */
export const hostedReminderScriptResultSchema = z
    .object({
        agentId: hostedIdSchema,
        attentionId: hostedIdSchema,
        exitCode: z.number().int(),
        fireId: hostedIdSchema,
        output: z.string().max(65_536),
        timedOut: z.boolean(),
        type: z.literal('reminder-script-result'),
    })
    .strict();

export type HostedReminderScriptResult = z.infer<typeof hostedReminderScriptResultSchema>;

export const hostedAgentSkillImportResultSchema = z.discriminatedUnion('status', [
    z
        .object({
            agentId: hostedIdSchema,
            requestId: hostedIdSchema,
            sourceId: hostedIdSchema,
            status: z.literal('accepted'),
            type: z.literal('agent-skill-import-result'),
            updatedAt: hostedTimestampSchema,
        })
        .strict(),
    z
        .object({
            agentId: hostedIdSchema,
            requestId: hostedIdSchema,
            skill: z
                .object({
                    description: z.string().max(500),
                    hash: z.string().regex(/^[a-f0-9]{64}$/u),
                    modifiedAt: hostedTimestampSchema,
                    name: z.string().trim().min(1).max(128),
                })
                .strict(),
            sourceId: hostedIdSchema,
            status: z.literal('applied'),
            type: z.literal('agent-skill-import-result'),
            updatedAt: hostedTimestampSchema,
        })
        .strict(),
    z
        .object({
            agentId: hostedIdSchema,
            error: z.string().trim().min(1).max(300),
            requestId: hostedIdSchema,
            sourceId: hostedIdSchema,
            status: z.literal('failed'),
            type: z.literal('agent-skill-import-result'),
            updatedAt: hostedTimestampSchema,
        })
        .strict(),
]);

export type HostedAgentSkillImportResult = z.infer<typeof hostedAgentSkillImportResultSchema>;

export const hostedAgentSkillFileResultSchema = z
    .object({
        agentId: hostedIdSchema,
        error: z.string().trim().min(1).max(300).optional(),
        requestId: hostedIdSchema,
        result: z
            .discriminatedUnion('kind', [
                z.object({ kind: z.literal('read'), value: hostedAgentSkillFileSchema }).strict(),
                z
                    .object({ kind: z.literal('updated'), value: hostedAgentSkillFileSchema })
                    .strict(),
                z.object({ kind: z.literal('deleted') }).strict(),
            ])
            .optional(),
        type: z.literal('agent-skill-file-result'),
    })
    .strict()
    .refine((value) => Boolean(value.error) !== Boolean(value.result));

export type HostedAgentSkillFileResult = z.infer<typeof hostedAgentSkillFileResultSchema>;

export const hostedAgentWorkspaceResultSchema = z
    .object({
        agentId: hostedIdSchema,
        error: z.string().trim().min(1).max(300).optional(),
        requestId: hostedIdSchema,
        result: z
            .discriminatedUnion('kind', [
                z
                    .object({
                        kind: z.literal('list'),
                        value: hostedWorkspaceFileListSchema,
                    })
                    .strict(),
                z
                    .object({
                        kind: z.literal('read'),
                        value: hostedWorkspaceFileContentSchema,
                    })
                    .strict(),
            ])
            .optional(),
        type: z.literal('agent-workspace-result'),
    })
    .strict()
    .refine((value) => Boolean(value.error) !== Boolean(value.result));

export type HostedAgentWorkspaceResult = z.infer<typeof hostedAgentWorkspaceResultSchema>;

/**
 * A Computer mints a per-launch runner credential from its Computer credential
 * before spawning the Agent. The credential is scoped to exactly one Agent,
 * run, and Server. The launch chat carries turn context; Agent API routes still
 * resolve each target and membership Server-side.
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
 * the author and Server, so the Agent supplies the message body and grammar
 * target; the Server resolves that target and access before writing.
 */
export const hostedAgentSendInputSchema = z
    .object({
        attachmentIds: z.array(hostedIdSchema).max(20).default([]),
        compositionId: z.string().trim().min(1).max(200).optional(),
        content: z.string().max(32_000).optional(),
        continueAnyway: z.boolean().default(false),
        nonce: z.string().trim().min(1).max(128),
        sendDraft: z.boolean().default(false),
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
export const hostedAgentTurnFailureKindSchema = z.enum([
    'authentication',
    'configuration',
    'input',
    'rate-limit',
    'session-resume',
    'timeout',
    'transport',
    'unknown',
]);

export const hostedAgentTurnSummarySchema = z
    .object({
        agentId: hostedIdSchema,
        endedAt: hostedTimestampSchema,
        failureKind: hostedAgentTurnFailureKindSchema.optional(),
        messageCount: z.number().int().nonnegative().max(10_000),
        /**
         * Whether the turn produced model-visible output (any durable send).
         * A failed turn that produced output must not have its work requeued —
         * doing so would re-trigger the output. Acceptance alone never sets
         * this flag; an accepted crash replays at least once.
         */
        outputProduced: z.boolean(),
        runId: hostedIdSchema,
        startedAt: hostedTimestampSchema,
        status: hostedAgentTurnStatusSchema,
        summary: z.string().max(2000),
        type: z.literal('turn'),
    })
    .strict();

export type HostedAgentTurnSummary = z.infer<typeof hostedAgentTurnSummarySchema>;
