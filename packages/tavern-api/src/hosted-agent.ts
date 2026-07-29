import * as z from 'zod';
import { agentCharacterSchema } from './agent-appearance.ts';
import { hostedWorkspacePathSchema } from './hosted-agent-runner.ts';
import { hostedChatSchema, hostedIdSchema } from './hosted-chat.ts';
import { agentArchetypeIdSchema } from './runtime/contracts.ts';

const hostedTimestampSchema = z.iso.datetime({ offset: true });

/**
 * A Computer reports only sanitized runtime and model inventory. Provider
 * credentials, session tokens, and OAuth material never leave the Computer, so
 * they have no field here by construction.
 */
export const hostedComputerModelSchema = z
    .object({
        id: z.string().trim().min(1).max(128),
        label: z.string().trim().min(1).max(200),
    })
    .strict();

export const hostedComputerRuntimeSchema = z
    .object({
        id: z.string().trim().min(1).max(64),
        label: z.string().trim().min(1).max(200),
        models: z.array(hostedComputerModelSchema).max(200),
    })
    .strict();

export const hostedAgentSkillMetadataSchema = z
    .object({
        description: z.string().max(500),
        hash: z.string().regex(/^[a-f0-9]{64}$/u),
        modifiedAt: hostedTimestampSchema,
        name: z.string().trim().min(1).max(128),
    })
    .strict();

export type HostedAgentSkillMetadata = z.infer<typeof hostedAgentSkillMetadataSchema>;

export const hostedImportableSkillSchema = z
    .object({
        description: z.string().max(500),
        id: hostedIdSchema,
        name: z.string().trim().min(1).max(128),
        source: z.string().trim().min(1).max(300),
    })
    .strict();

export type HostedImportableSkill = z.infer<typeof hostedImportableSkillSchema>;

export const hostedComputerInventorySchema = z
    .object({
        agentSkills: z
            .array(
                z
                    .object({
                        agentId: hostedIdSchema,
                        skills: z.array(hostedAgentSkillMetadataSchema).max(500),
                    })
                    .strict()
            )
            .max(500)
            .optional(),
        importableSkills: z.array(hostedImportableSkillSchema).max(1000).optional(),
        runtimes: z.array(hostedComputerRuntimeSchema).max(50),
    })
    .strict();

export type HostedComputerInventory = z.infer<typeof hostedComputerInventorySchema>;

export const hostedAgentRoleSchema = z.enum(['admin', 'member']);

/**
 * `pending` — no Computer-reported effective snapshot matches the desired
 * runtime/model yet. `applied` — the Computer reports the exact desired
 * runtime and model with nothing missing. `degraded` — the Computer reports
 * missing local resources; Grotto never substitutes another runtime or model.
 */
export const hostedAgentStatusSchema = z.enum(['applied', 'degraded', 'pending']);

export type HostedAgentStatus = z.infer<typeof hostedAgentStatusSchema>;

export const hostedAgentAvailabilitySchema = z.enum([
    'error',
    'idle',
    'offline',
    'stopped',
    'working',
]);

export type HostedAgentAvailability = z.infer<typeof hostedAgentAvailabilitySchema>;

export const hostedAgentSchema = z
    .object({
        archetype: agentArchetypeIdSchema.nullable(),
        availability: hostedAgentAvailabilitySchema,
        character: agentCharacterSchema,
        computerId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
        description: z.string().max(500).nullable(),
        desiredModelId: z.string(),
        desiredRuntimeId: z.string(),
        displayName: z.string(),
        dmChatId: hostedIdSchema.nullable(),
        effectiveModelId: z.string().nullable(),
        effectiveReportedAt: hostedTimestampSchema.nullable(),
        effectiveRuntimeId: z.string().nullable(),
        handle: z.string(),
        id: hostedIdSchema,
        missingResources: z.array(z.string()),
        role: hostedAgentRoleSchema,
        serverId: hostedIdSchema,
        status: hostedAgentStatusSchema,
    })
    .strict();

export type HostedAgent = z.infer<typeof hostedAgentSchema>;

export const hostedAgentHandleSchema = z
    .string()
    .trim()
    .toLowerCase()
    .regex(
        /^[a-z0-9][a-z0-9-]{1,30}$/u,
        'A handle is 2-31 lowercase letters, numbers, or hyphens.'
    );

/** Creating an Agent binds it to exactly one reported Computer, runtime, and model. */
export const hostedCreateAgentInputSchema = z
    .object({
        archetype: agentArchetypeIdSchema.optional(),
        computerId: hostedIdSchema,
        description: z.string().trim().min(1).max(500).nullable().optional(),
        displayName: z.string().trim().min(1).max(80),
        handle: hostedAgentHandleSchema,
        modelId: z.string().trim().min(1).max(128),
        role: hostedAgentRoleSchema.default('member'),
        runtimeId: z.string().trim().min(1).max(64),
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedCreateAgentInput = z.infer<typeof hostedCreateAgentInputSchema>;

/** Deletion retires the Server record but preserves authored collaboration history. */
export const hostedDeleteAgentInputSchema = z
    .object({
        agentId: hostedIdSchema,
        confirmation: z.string().trim().min(1).max(80),
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedDeleteAgentInput = z.infer<typeof hostedDeleteAgentInputSchema>;

/** Runtime/model may change; the Computer assignment never does, so it is absent here. */
export const hostedConfigureAgentInputSchema = z
    .object({
        agentId: hostedIdSchema,
        modelId: z.string().trim().min(1).max(128),
        runtimeId: z.string().trim().min(1).max(64),
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedConfigureAgentInput = z.infer<typeof hostedConfigureAgentInputSchema>;

export const hostedUpdateAgentProfileInputSchema = z
    .object({
        agentId: hostedIdSchema,
        description: z.string().trim().max(500).nullable(),
        displayName: z.string().trim().min(1).max(80),
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedUpdateAgentProfileInput = z.infer<typeof hostedUpdateAgentProfileInputSchema>;

export const hostedAgentCreatedSchema = z
    .object({ agent: hostedAgentSchema, chat: hostedChatSchema })
    .strict();

export type HostedAgentCreated = z.infer<typeof hostedAgentCreatedSchema>;

export const hostedAgentListInputSchema = z.object({ serverId: hostedIdSchema }).strict();

export const hostedAgentListSchema = z.array(hostedAgentSchema);

export const hostedAgentDetailInputSchema = z
    .object({ agentId: hostedIdSchema, serverId: hostedIdSchema })
    .strict();

export const hostedAgentActivityInputSchema = hostedAgentDetailInputSchema.extend({
    limit: z.number().int().min(1).max(100).default(50),
});

export const hostedAgentActivityEntrySchema = z
    .object({
        endedAt: hostedTimestampSchema,
        messageCount: z.number().int().nonnegative(),
        runId: hostedIdSchema,
        startedAt: hostedTimestampSchema,
        status: z.enum(['completed', 'failed']),
        summary: z.string().max(2000),
    })
    .strict();

export type HostedAgentActivityEntry = z.infer<typeof hostedAgentActivityEntrySchema>;

export const hostedAgentActivitySchema = z.array(hostedAgentActivityEntrySchema);

export const hostedAgentWorkspaceListInputSchema = hostedAgentDetailInputSchema.extend({
    path: hostedWorkspacePathSchema.default(''),
});

export const hostedAgentWorkspaceReadInputSchema = hostedAgentDetailInputSchema.extend({
    path: hostedWorkspacePathSchema.refine((value) => value.length > 0),
});

/** Targets one Agent for a delivery control action or read. */
export const hostedAgentDeliveryControlInputSchema = z
    .object({ agentId: hostedIdSchema, serverId: hostedIdSchema })
    .strict();

export type HostedAgentDeliveryControlInput = z.infer<typeof hostedAgentDeliveryControlInputSchema>;

export const hostedAgentResetInputSchema = hostedAgentDeliveryControlInputSchema.extend({
    kind: z.enum(['full', 'session']).default('session'),
});

export type HostedAgentResetInput = z.infer<typeof hostedAgentResetInputSchema>;

export const hostedAgentImportSkillInputSchema = z
    .object({
        agentId: hostedIdSchema,
        serverId: hostedIdSchema,
        sourceId: hostedIdSchema,
    })
    .strict();

export type HostedAgentImportSkillInput = z.infer<typeof hostedAgentImportSkillInputSchema>;

export const hostedAgentImportSkillResultSchema = z
    .object({ skill: hostedAgentSkillMetadataSchema })
    .strict();

/**
 * The Server-owned delivery state for one Agent. `stopped` is the persisted
 * human Stop flag, `running` is whether a turn is in flight, and `pending` is
 * how many queued inbox units await the next turn.
 */
export const hostedAgentDeliveryStateSchema = z
    .object({
        agentId: hostedIdSchema,
        pending: z.number().int().nonnegative(),
        running: z.boolean(),
        stopped: z.boolean(),
    })
    .strict();

export type HostedAgentDeliveryState = z.infer<typeof hostedAgentDeliveryStateSchema>;

/**
 * One Agent's Computer-reported effective state. A null runtime or model means
 * the Computer could not resolve the desired resource; `missingResources`
 * names each missing runtime, model, skill, or connection.
 */
export const hostedAgentEffectiveStateSchema = z
    .object({
        agentId: hostedIdSchema,
        missingResources: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
        modelId: z.string().trim().min(1).max(128).nullable(),
        runtimeId: z.string().trim().min(1).max(64).nullable(),
    })
    .strict();

export type HostedAgentEffectiveState = z.infer<typeof hostedAgentEffectiveStateSchema>;

/** The compact report a Computer pushes over its attachment socket. */
export const hostedComputerReportSchema = z
    .object({
        agents: z.array(hostedAgentEffectiveStateSchema).max(500).default([]),
        inventory: hostedComputerInventorySchema,
    })
    .strict();

export type HostedComputerReport = z.infer<typeof hostedComputerReportSchema>;
