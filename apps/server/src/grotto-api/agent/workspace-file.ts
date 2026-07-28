import { hostedAgentWorkspaceReadInputSchema, hostedWorkspaceFileContentSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import {
    AgentWorkspaceAccessError,
    readHostedAgentWorkspaceFile,
} from '../../hosted-agents/agent-workspace.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentWorkspaceFileProcedure = memberProcedure
    .input(hostedAgentWorkspaceReadInputSchema)
    .output(hostedWorkspaceFileContentSchema)
    .query(async ({ ctx, input }) => {
        try {
            return await readHostedAgentWorkspaceFile(
                ctx.grottoDb,
                ctx.computerConnections,
                ctx.member,
                input
            );
        } catch (cause) {
            if (cause instanceof AgentWorkspaceAccessError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw new TRPCError({
                cause,
                code: 'SERVICE_UNAVAILABLE',
                message:
                    cause instanceof Error ? cause.message : 'The workspace file is unavailable.',
            });
        }
    });
