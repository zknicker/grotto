import { hostedAgentWorkspaceListInputSchema, hostedWorkspaceFileListSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import {
    AgentWorkspaceAccessError,
    listHostedAgentWorkspace,
} from '../../hosted-agents/agent-workspace.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentWorkspaceFilesProcedure = memberProcedure
    .input(hostedAgentWorkspaceListInputSchema)
    .output(hostedWorkspaceFileListSchema)
    .query(async ({ ctx, input }) => {
        try {
            return await listHostedAgentWorkspace(
                ctx.grottoDb,
                ctx.computerConnections,
                ctx.member,
                input
            );
        } catch (cause) {
            throw workspaceError(cause);
        }
    });

function workspaceError(cause: unknown) {
    if (cause instanceof AgentWorkspaceAccessError) {
        return new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
    }
    return new TRPCError({
        cause,
        code: 'SERVICE_UNAVAILABLE',
        message: cause instanceof Error ? cause.message : 'Workspace files are unavailable.',
    });
}
