import {
    mcpAgentHostToolGrantInputSchema,
    mcpAgentIdInputSchema,
    mcpAgentToolGrantInputSchema,
    mcpConnectionCreateInputSchema,
    mcpConnectionIdInputSchema,
    mcpConnectionOAuthStartInputSchema,
    mcpConnectionUpdateInputSchema,
    mcpPresetAccountCreateInputSchema,
} from '../../mcp/contracts.ts';
import {
    addMcpConnection,
    addMcpPresetAccount,
    deleteMcpConnection,
    disconnectMcpConnection,
    listMcpAgentGrants,
    listMcpAgentHostTools,
    listMcpConnections,
    listMcpConnectionTools,
    refreshMcpConnection,
    setMcpAgentHostToolGrant,
    setMcpAgentToolGrant,
    startMcpConnectionOAuth,
    testMcpConnection,
    updateMcpConnection,
} from '../../mcp/service.ts';
import { publicProcedure } from '../trpc.ts';

export const mcpConnectionsProcedure = publicProcedure.query(listMcpConnections);
export const addMcpConnectionProcedure = publicProcedure
    .input(mcpConnectionCreateInputSchema)
    .mutation(({ input }) => addMcpConnection(input));
export const addMcpPresetAccountProcedure = publicProcedure
    .input(mcpPresetAccountCreateInputSchema)
    .mutation(({ input }) => addMcpPresetAccount(input));
export const updateMcpConnectionProcedure = publicProcedure
    .input(mcpConnectionUpdateInputSchema)
    .mutation(({ input }) => updateMcpConnection(input.connectionId, input.connection));
export const deleteMcpConnectionProcedure = publicProcedure
    .input(mcpConnectionIdInputSchema)
    .mutation(({ input }) => deleteMcpConnection(input.connectionId));
export const disconnectMcpConnectionProcedure = publicProcedure
    .input(mcpConnectionIdInputSchema)
    .mutation(({ input }) => disconnectMcpConnection(input.connectionId));
export const testMcpConnectionProcedure = publicProcedure
    .input(mcpConnectionIdInputSchema)
    .mutation(({ input }) => testMcpConnection(input.connectionId));
export const mcpConnectionToolsProcedure = publicProcedure
    .input(mcpConnectionIdInputSchema)
    .query(({ input }) => listMcpConnectionTools(input.connectionId));
export const refreshMcpConnectionProcedure = publicProcedure
    .input(mcpConnectionIdInputSchema)
    .mutation(({ input }) => refreshMcpConnection(input.connectionId));
export const mcpAgentGrantsProcedure = publicProcedure
    .input(mcpAgentIdInputSchema)
    .query(({ input }) => listMcpAgentGrants(input.agentId));
export const mcpAgentHostToolsProcedure = publicProcedure
    .input(mcpAgentIdInputSchema)
    .query(({ input }) => listMcpAgentHostTools(input.agentId));
export const setMcpAgentToolGrantProcedure = publicProcedure
    .input(mcpAgentToolGrantInputSchema)
    .mutation(({ input }) =>
        setMcpAgentToolGrant({
            agentId: input.agentId,
            connectionId: input.connectionId,
            enabled: input.grant.enabled,
            toolName: input.toolName,
        })
    );
export const setMcpAgentHostToolGrantProcedure = publicProcedure
    .input(mcpAgentHostToolGrantInputSchema)
    .mutation(({ input }) =>
        setMcpAgentHostToolGrant({
            agentId: input.agentId,
            enabled: input.grant.enabled,
            toolId: input.toolId,
        })
    );
export const startMcpConnectionOAuthProcedure = publicProcedure
    .input(mcpConnectionOAuthStartInputSchema)
    .mutation(({ input }) =>
        startMcpConnectionOAuth(input.connectionId, input.allowAuthorizationServerOrigin)
    );
