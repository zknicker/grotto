import {
    agentRuntimeHostToolGrantUpdateSchema,
    agentRuntimeHostToolIdSchema,
    agentRuntimeMcpAgentToolGrantUpdateSchema,
    agentRuntimeMcpConnectionCreateSchema,
    agentRuntimeMcpConnectionUpdateSchema,
    agentRuntimeMcpPresetAccountCreateSchema,
} from '@tavern/api';
import { z } from 'zod';

export const mcpConnectionIdInputSchema = z.object({
    connectionId: z.string().trim().min(1).max(100),
});

export const mcpConnectionOAuthStartInputSchema = mcpConnectionIdInputSchema.extend({
    allowAuthorizationServerOrigin: z.boolean().default(false),
});

export const mcpConnectionCreateInputSchema = agentRuntimeMcpConnectionCreateSchema;
export const mcpPresetAccountCreateInputSchema = agentRuntimeMcpPresetAccountCreateSchema;

export const mcpConnectionUpdateInputSchema = mcpConnectionIdInputSchema.extend({
    connection: agentRuntimeMcpConnectionUpdateSchema,
});

export const mcpAgentIdInputSchema = z.object({
    agentId: z.string().trim().min(1),
});

export const mcpAgentToolGrantInputSchema = mcpConnectionIdInputSchema
    .merge(mcpAgentIdInputSchema)
    .extend({
        grant: agentRuntimeMcpAgentToolGrantUpdateSchema,
        toolName: z.string().trim().min(1),
    });

export const mcpAgentHostToolGrantInputSchema = mcpAgentIdInputSchema.extend({
    grant: agentRuntimeHostToolGrantUpdateSchema,
    toolId: agentRuntimeHostToolIdSchema,
});
