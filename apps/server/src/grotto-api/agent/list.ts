import { hostedAgentListInputSchema, hostedAgentListSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import { listHostedAgents } from '../../hosted-agents/list-agents.ts';
import { memberProcedure } from '../server/procedure.ts';

export const listAgentsProcedure = memberProcedure
    .input(hostedAgentListInputSchema)
    .output(hostedAgentListSchema)
    .query(async ({ ctx, input }) => {
        try {
            return await listHostedAgents(ctx.grottoDb, ctx.member, input.serverId);
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
