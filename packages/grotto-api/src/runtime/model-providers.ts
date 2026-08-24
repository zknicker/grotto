import * as z from 'zod';

export const knownAgentRuntimeModelProviderIds = [
    'claude',
    'codex',
    'custom',
    'kimi',
    'openai',
    'openrouter',
] as const;

export const agentRuntimeModelProviderIdSchema = z.string().trim().min(1);
export const modelExecutionProviderSchema = z.enum(['claude', 'codex', 'opencode']);
export const agentRuntimeModelProviderIds = knownAgentRuntimeModelProviderIds;

export const agentRuntimeModelProviderCapabilitySchema = z.object({
    executionProvider: modelExecutionProviderSchema.nullable(),
    supportsMemory: z.boolean(),
    supportsSubAgentRouting: z.boolean(),
});

export type AgentRuntimeModelProviderId = z.infer<typeof agentRuntimeModelProviderIdSchema>;
export type ModelExecutionProvider = z.infer<typeof modelExecutionProviderSchema>;
export type AgentRuntimeModelProviderCapability = z.infer<
    typeof agentRuntimeModelProviderCapabilitySchema
>;

export const agentRuntimeModelProviderCapabilities = {
    claude: {
        executionProvider: 'claude',
        supportsMemory: true,
        supportsSubAgentRouting: true,
    },
    codex: {
        executionProvider: 'codex',
        supportsMemory: true,
        supportsSubAgentRouting: true,
    },
    custom: {
        executionProvider: null,
        supportsMemory: false,
        supportsSubAgentRouting: false,
    },
    kimi: {
        executionProvider: null,
        supportsMemory: true,
        supportsSubAgentRouting: false,
    },
    openai: {
        executionProvider: null,
        supportsMemory: true,
        supportsSubAgentRouting: false,
    },
    openrouter: {
        executionProvider: null,
        supportsMemory: true,
        supportsSubAgentRouting: false,
    },
} as const satisfies Record<string, AgentRuntimeModelProviderCapability>;
