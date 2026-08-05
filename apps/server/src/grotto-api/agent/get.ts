import { hostedAgentDetailInputSchema, hostedAgentSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { getHostedAgent } from '../../hosted-agents/get-agent.ts';
import { memberProcedure } from '../server/procedure.ts';

export const getAgentProcedure = memberProcedure
    .input(hostedAgentDetailInputSchema)
    .output(hostedAgentSchema)
    .query(async ({ ctx, input }) => {
        const agent = await getHostedAgent(ctx.grottoDb, ctx.member, input.serverId, input.agentId);
        if (!agent) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found.' });
        }
        return agent;
    });
