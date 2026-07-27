import * as z from 'zod';
import { hostedChatSchema, hostedIdSchema } from './hosted-chat.ts';

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

export const hostedComputerInventorySchema = z
    .object({ runtimes: z.array(hostedComputerRuntimeSchema).max(50) })
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

export const hostedAgentSchema = z
    .object({
        computerId: hostedIdSchema,
        createdAt: hostedTimestampSchema,
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
        computerId: hostedIdSchema,
        displayName: z.string().trim().min(1).max(80),
        handle: hostedAgentHandleSchema,
        modelId: z.string().trim().min(1).max(128),
        role: hostedAgentRoleSchema.default('member'),
        runtimeId: z.string().trim().min(1).max(64),
        serverId: hostedIdSchema,
    })
    .strict();

export type HostedCreateAgentInput = z.infer<typeof hostedCreateAgentInputSchema>;

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

export const hostedAgentCreatedSchema = z
    .object({ agent: hostedAgentSchema, chat: hostedChatSchema })
    .strict();

export type HostedAgentCreated = z.infer<typeof hostedAgentCreatedSchema>;

export const hostedAgentListInputSchema = z.object({ serverId: hostedIdSchema }).strict();

export const hostedAgentListSchema = z.array(hostedAgentSchema);

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
