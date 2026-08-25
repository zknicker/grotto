import * as z from 'zod';
import { participantHandleSchema } from './participant-handle.ts';
import { workspacePathSchema } from './agent-runner.ts';
import { chatSchema, idSchema } from './chat.ts';

const timestampSchema = z.iso.datetime({ offset: true });

/**
 * A Computer reports only sanitized runtime and model inventory. Provider
 * credentials, session tokens, and OAuth material never leave the Computer, so
 * they have no field here by construction.
 */
export const computerModelSchema = z
    .object({
        id: z.string().trim().min(1).max(128),
        label: z.string().trim().min(1).max(200),
    })
    .strict();

export const computerRuntimeSchema = z
    .object({
        id: z.string().trim().min(1).max(64),
        label: z.string().trim().min(1).max(200),
        models: z.array(computerModelSchema).max(200),
    })
    .strict();

export const agentSkillMetadataSchema = z
    .object({
        description: z.string().max(500),
        hash: z.string().regex(/^[a-f0-9]{64}$/u),
        modifiedAt: timestampSchema,
        name: z.string().trim().min(1).max(128),
    })
    .strict();

export type AgentSkillMetadata = z.infer<typeof agentSkillMetadataSchema>;

export const agentSkillImportRecordSchema = z.discriminatedUnion('status', [
    z
        .object({
            agentId: idSchema,
            requestId: idSchema,
            sourceId: idSchema,
            status: z.literal('accepted'),
            updatedAt: timestampSchema,
        })
        .strict(),
    z
        .object({
            agentId: idSchema,
            requestId: idSchema,
            skill: agentSkillMetadataSchema,
            sourceId: idSchema,
            status: z.literal('applied'),
            updatedAt: timestampSchema,
        })
        .strict(),
    z
        .object({
            agentId: idSchema,
            error: z.string().trim().min(1).max(300),
            requestId: idSchema,
            sourceId: idSchema,
            status: z.literal('failed'),
            updatedAt: timestampSchema,
        })
        .strict(),
]);

export type AgentSkillImportRecord = z.infer<typeof agentSkillImportRecordSchema>;

export const importableSkillSchema = z
    .object({
        description: z.string().max(500),
        id: idSchema,
        name: z.string().trim().min(1).max(128),
        source: z.string().trim().min(1).max(300),
    })
    .strict();

export type ImportableSkill = z.infer<typeof importableSkillSchema>;

export const computerInventorySchema = z
    .object({
        agentSkillImports: z.array(agentSkillImportRecordSchema).max(100).optional(),
        agentSkills: z
            .array(
                z
                    .object({
                        agentId: idSchema,
                        skills: z.array(agentSkillMetadataSchema).max(500),
                    })
                    .strict()
            )
            .max(500)
            .optional(),
        importableSkills: z.array(importableSkillSchema).max(1000).optional(),
        name: z.string().trim().min(1).max(100).optional(),
        runtimes: z.array(computerRuntimeSchema).max(50),
    })
    .strict();

export type ComputerInventory = z.infer<typeof computerInventorySchema>;

export const agentRoleSchema = z.enum(['admin', 'member']);

/**
 * `pending` — no Computer-reported effective snapshot matches the desired
 * runtime/model yet. `applied` — the Computer reports the exact desired
 * runtime and model with nothing missing. `degraded` — the Computer reports
 * missing local resources; Grotto never substitutes another runtime or model.
 */
export const agentStatusSchema = z.enum(['applied', 'degraded', 'pending']);

export type AgentStatus = z.infer<typeof agentStatusSchema>;

export const agentAvailabilitySchema = z.enum(['error', 'idle', 'offline', 'stopped', 'working']);

export type AgentAvailability = z.infer<typeof agentAvailabilitySchema>;

export const agentSchema = z
    .object({
        availability: agentAvailabilitySchema,
        avatarUrl: z.string().nullable(),
        computerId: idSchema,
        createdAt: timestampSchema,
        createdByUserId: z.string().nullable(),
        description: z.string().max(500).nullable(),
        desiredModelId: z.string(),
        desiredRuntimeId: z.string(),
        displayName: z.string(),
        dmChatId: idSchema.nullable(),
        effectiveModelId: z.string().nullable(),
        effectiveReportedAt: timestampSchema.nullable(),
        effectiveRuntimeId: z.string().nullable(),
        factoryKind: z.enum(['cove', 'ordinary']),
        handle: z.string(),
        id: idSchema,
        missingResources: z.array(z.string()),
        role: agentRoleSchema,
        serverId: idSchema,
        status: agentStatusSchema,
    })
    .strict();

export type Agent = z.infer<typeof agentSchema>;

export const agentHandleSchema = participantHandleSchema;

/** Creating an Agent binds it to exactly one reported Computer, runtime, and model. */
export const createAgentInputSchema = z
    .object({
        computerId: idSchema,
        description: z.string().trim().min(1).max(500).nullable().optional(),
        displayName: z.string().trim().min(1).max(80),
        handle: agentHandleSchema,
        modelId: z.string().trim().min(1).max(128),
        role: agentRoleSchema.default('member'),
        runtimeId: z.string().trim().min(1).max(64),
        serverId: idSchema,
    })
    .strict();

export type CreateAgentInput = z.infer<typeof createAgentInputSchema>;

/** Deletion retires the Server record but preserves authored collaboration history. */
export const deleteAgentInputSchema = z
    .object({
        agentId: idSchema,
        confirmation: z.string().trim().min(1).max(80),
        serverId: idSchema,
    })
    .strict();

export type DeleteAgentInput = z.infer<typeof deleteAgentInputSchema>;

/** Runtime/model may change; the Computer assignment never does, so it is absent here. */
export const configureAgentInputSchema = z
    .object({
        agentId: idSchema,
        modelId: z.string().trim().min(1).max(128),
        runtimeId: z.string().trim().min(1).max(64),
        serverId: idSchema,
    })
    .strict();

export type ConfigureAgentInput = z.infer<typeof configureAgentInputSchema>;

export const updateAgentProfileInputSchema = z
    .object({
        agentId: idSchema,
        description: z.string().trim().max(500).nullable(),
        displayName: z.string().trim().min(1).max(80),
        serverId: idSchema,
    })
    .strict();

export type UpdateAgentProfileInput = z.infer<typeof updateAgentProfileInputSchema>;

export const agentCreatedSchema = z.object({ agent: agentSchema, chat: chatSchema }).strict();

export type AgentCreated = z.infer<typeof agentCreatedSchema>;

export const agentListInputSchema = z.object({ serverId: idSchema }).strict();

export const agentListSchema = z.array(agentSchema);

export const agentDetailInputSchema = z.object({ agentId: idSchema, serverId: idSchema }).strict();

/** Explicit opt-in request for one Computer-local Agent execution journal. */
export const agentExecutionJournalInputSchema = agentDetailInputSchema.extend({
    runId: idSchema,
});

export type AgentExecutionJournalInput = z.infer<typeof agentExecutionJournalInputSchema>;

export const agentTurnDetailInputSchema = agentExecutionJournalInputSchema;

export const agentActivityInputSchema = agentDetailInputSchema.extend({
    limit: z.number().int().min(1).max(100).default(50),
});

export const agentActivityEntrySchema = z
    .object({
        endedAt: timestampSchema,
        messageCount: z.number().int().nonnegative(),
        runId: idSchema,
        startedAt: timestampSchema,
        status: z.enum(['completed', 'failed']),
        summary: z.string().max(2000),
    })
    .strict();

export type AgentActivityEntry = z.infer<typeof agentActivityEntrySchema>;

export const agentActivitySchema = z.array(agentActivityEntrySchema);

const agentLifecycleBaseSchema = z.object({
    agentId: idSchema,
    chatId: idSchema,
    emittedAt: timestampSchema,
    runId: idSchema,
    serverId: idSchema,
});

/**
 * Volatile execution projection for one Agent run. Durable turn
 * evidence remains in `agent.activity`; this feed exists so Grotto App surfaces can
 * react immediately without inventing transcript rows.
 */
export const agentLifecycleEventSchema = z.discriminatedUnion('phase', [
    agentLifecycleBaseSchema
        .extend({
            phase: z.literal('working'),
        })
        .strict(),
    agentLifecycleBaseSchema
        .extend({
            phase: z.literal('reading'),
        })
        .strict(),
    agentLifecycleBaseSchema
        .extend({
            compositionId: idSchema,
            phase: z.literal('sending'),
            text: z.string().min(1).max(32_000),
        })
        .strict(),
    agentLifecycleBaseSchema
        .extend({
            outcome: z.enum(['completed', 'failed', 'stopped']),
            phase: z.literal('settled'),
        })
        .strict(),
]);

export type AgentLifecycleEvent = z.infer<typeof agentLifecycleEventSchema>;

export const agentLifecycleSubscriptionInputSchema = z.object({ serverId: idSchema }).strict();

export const agentWorkspaceListInputSchema = agentDetailInputSchema.extend({
    includeHidden: z.boolean().optional().default(false),
    path: workspacePathSchema.default(''),
});

export const agentWorkspaceReadInputSchema = agentDetailInputSchema.extend({
    includeHidden: z.boolean().optional().default(false),
    path: workspacePathSchema.refine((value) => value.length > 0),
});

const agentSkillNameInputSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u);

export const agentSkillFileReadInputSchema = agentDetailInputSchema.extend({
    name: agentSkillNameInputSchema,
});

export const agentSkillFileUpdateInputSchema = agentSkillFileReadInputSchema.extend({
    content: z.string().max(2 * 1024 * 1024),
    expectedHash: z.string().regex(/^[a-f0-9]{64}$/u),
});

export const agentSkillFileDeleteInputSchema = agentSkillFileReadInputSchema.extend({
    expectedHash: z.string().regex(/^[a-f0-9]{64}$/u),
});

/** Targets one Agent for a delivery control action or read. */
export const agentDeliveryControlInputSchema = z
    .object({ agentId: idSchema, serverId: idSchema })
    .strict();

export type AgentDeliveryControlInput = z.infer<typeof agentDeliveryControlInputSchema>;

export const agentResetInputSchema = agentDeliveryControlInputSchema.extend({
    kind: z.enum(['full', 'session']).default('session'),
});

export type AgentResetInput = z.infer<typeof agentResetInputSchema>;

export const agentImportSkillInputSchema = z
    .object({
        agentId: idSchema,
        serverId: idSchema,
        sourceId: idSchema,
    })
    .strict();

export type AgentImportSkillInput = z.infer<typeof agentImportSkillInputSchema>;

export const agentImportSkillResultSchema = z
    .object({
        requestId: idSchema,
        status: z.literal('accepted'),
    })
    .strict();

/**
 * The Server-owned delivery state for one Agent. `stopped` is the persisted
 * human Stop flag, `running` is whether a turn is in flight, and `pending` is
 * how many queued inbox units await the next turn.
 */
export const agentDeliveryStateSchema = z
    .object({
        agentId: idSchema,
        pending: z.number().int().nonnegative(),
        running: z.boolean(),
        stopped: z.boolean(),
    })
    .strict();

export type AgentDeliveryState = z.infer<typeof agentDeliveryStateSchema>;

/**
 * One settled Agent turn. `outputProduced` and `failureKind` are what make a
 * silent turn readable: a completed turn with no output and no messages is
 * positive proof the Agent chose to stay quiet, not evidence of a lost run.
 */
export const agentTurnSchema = z
    .object({
        agentId: idSchema,
        endedAt: timestampSchema,
        failureKind: z.string().trim().min(1).max(64).nullable(),
        messageCount: z.number().int().nonnegative(),
        outputProduced: z.boolean(),
        runId: idSchema,
        startedAt: timestampSchema,
        status: z.enum(['completed', 'failed']),
        summary: z.string().max(2000).nullable(),
    })
    .strict();

export type AgentTurn = z.infer<typeof agentTurnSchema>;

export const agentTurnsInputSchema = agentDetailInputSchema.extend({
    limit: z.number().int().min(1).max(50).default(10),
});

export type AgentTurnsInput = z.infer<typeof agentTurnsInputSchema>;

export const agentTurnsSchema = z.array(agentTurnSchema);

/**
 * One durable delivery of one message to one Agent. `seen` rows are retained
 * after settlement with the `turnId` that consumed them, so an observer can
 * tell "the Agent never received it" from "the Agent received it and said
 * nothing".
 */
export const agentDeliveryRecordSchema = z
    .object({
        acceptedAt: timestampSchema.nullable(),
        agentId: idSchema,
        chatId: idSchema,
        createdAt: timestampSchema,
        messageId: z.string().trim().min(1).max(128),
        seenAt: timestampSchema.nullable(),
        servedAt: timestampSchema.nullable(),
        state: z.enum(['queued', 'accepted', 'served', 'seen']),
        turnId: z.string().trim().min(1).max(128).nullable(),
    })
    .strict();

export type AgentDeliveryRecord = z.infer<typeof agentDeliveryRecordSchema>;

export const agentDeliveriesInputSchema = agentDetailInputSchema.extend({
    limit: z.number().int().min(1).max(100).default(50),
});

export type AgentDeliveriesInput = z.infer<typeof agentDeliveriesInputSchema>;

export const agentDeliveriesSchema = z.array(agentDeliveryRecordSchema);

/**
 * One Agent's Computer-reported effective state. A null runtime or model means
 * the Computer could not resolve the desired resource; `missingResources`
 * names each missing runtime, model, skill, or connection.
 */
export const agentEffectiveStateSchema = z
    .object({
        agentId: idSchema,
        missingResources: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
        modelId: z.string().trim().min(1).max(128).nullable(),
        runtimeId: z.string().trim().min(1).max(64).nullable(),
    })
    .strict();

export type AgentEffectiveState = z.infer<typeof agentEffectiveStateSchema>;

/** The compact report a Computer pushes over its attachment socket. */
export const computerReportSchema = z
    .object({
        agents: z.array(agentEffectiveStateSchema).max(500).default([]),
        inventory: computerInventorySchema,
    })
    .strict();

export type ComputerReport = z.infer<typeof computerReportSchema>;
