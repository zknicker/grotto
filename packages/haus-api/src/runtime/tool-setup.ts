import * as z from 'zod';

/**
 * Tool setup contracts.
 *
 * A tool that reports "needs setup" is configured through the engine's
 * provider matrix: pick a provider, save its env keys, and optionally run the
 * provider's post-setup install action. Runtime proxies these surfaces.
 */

export const agentRuntimeToolEnvVarSchema = z.object({
    defaultValue: z.string().nullable(),
    isSet: z.boolean(),
    key: z.string().trim().min(1),
    prompt: z.string(),
    url: z.string().nullable(),
});

export const agentRuntimeToolProviderSchema = z.object({
    badge: z.string(),
    envVars: z.array(agentRuntimeToolEnvVarSchema),
    isActive: z.boolean(),
    name: z.string().trim().min(1),
    postSetup: z.string().nullable(),
    requiresEngineAuth: z.boolean(),
    tag: z.string(),
});

export const agentRuntimeToolConfigSchema = z.object({
    activeProvider: z.string().nullable(),
    hasCategory: z.boolean(),
    name: z.string().trim().min(1),
    providers: z.array(agentRuntimeToolProviderSchema),
});

export const agentRuntimeToolProviderSelectSchema = z.object({
    provider: z.string().trim().min(1).max(100),
});

export const agentRuntimeToolProviderSelectResultSchema = z.object({
    name: z.string(),
    ok: z.boolean(),
    provider: z.string(),
});

export const agentRuntimeToolEnvUpdateSchema = z.object({
    env: z.record(z.string().trim().min(1), z.string().max(4000)),
});

export const agentRuntimeToolEnvUpdateResultSchema = z.object({
    isSet: z.record(z.string(), z.boolean()),
    name: z.string(),
    ok: z.boolean(),
    saved: z.array(z.string()),
    skipped: z.array(z.string()),
});

export const agentRuntimeToolPostSetupSchema = z.object({
    key: z.string().trim().min(1).max(100),
});

export type AgentRuntimeToolConfig = z.infer<typeof agentRuntimeToolConfigSchema>;
export type AgentRuntimeToolEnvUpdate = z.infer<typeof agentRuntimeToolEnvUpdateSchema>;
export type AgentRuntimeToolEnvUpdateResult = z.infer<typeof agentRuntimeToolEnvUpdateResultSchema>;
export type AgentRuntimeToolEnvVar = z.infer<typeof agentRuntimeToolEnvVarSchema>;
export type AgentRuntimeToolPostSetup = z.infer<typeof agentRuntimeToolPostSetupSchema>;
export type AgentRuntimeToolProvider = z.infer<typeof agentRuntimeToolProviderSchema>;
export type AgentRuntimeToolProviderSelect = z.infer<typeof agentRuntimeToolProviderSelectSchema>;
export type AgentRuntimeToolProviderSelectResult = z.infer<
    typeof agentRuntimeToolProviderSelectResultSchema
>;
