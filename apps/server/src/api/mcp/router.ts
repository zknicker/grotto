import { createRouter } from '../trpc.ts';
import {
    addMcpConnectionProcedure,
    addMcpPresetAccountProcedure,
    deleteMcpConnectionProcedure,
    disconnectMcpConnectionProcedure,
    mcpAgentGrantsProcedure,
    mcpAgentHostToolsProcedure,
    mcpConnectionsProcedure,
    mcpConnectionToolsProcedure,
    refreshMcpConnectionProcedure,
    setMcpAgentHostToolGrantProcedure,
    setMcpAgentToolGrantProcedure,
    startMcpConnectionOAuthProcedure,
    testMcpConnectionProcedure,
    updateMcpConnectionProcedure,
} from './procedures.ts';

export const mcpRouter = createRouter({
    add: addMcpConnectionProcedure,
    addPresetAccount: addMcpPresetAccountProcedure,
    agentGrants: mcpAgentGrantsProcedure,
    agentHostTools: mcpAgentHostToolsProcedure,
    connectionTools: mcpConnectionToolsProcedure,
    delete: deleteMcpConnectionProcedure,
    disconnect: disconnectMcpConnectionProcedure,
    list: mcpConnectionsProcedure,
    refresh: refreshMcpConnectionProcedure,
    setAgentToolGrant: setMcpAgentToolGrantProcedure,
    setAgentHostToolGrant: setMcpAgentHostToolGrantProcedure,
    startOAuth: startMcpConnectionOAuthProcedure,
    test: testMcpConnectionProcedure,
    update: updateMcpConnectionProcedure,
});
