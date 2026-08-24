import { agentDetailInputSchema, agentSchema } from '@grotto/api';
import { TRPCError } from '@trpc/server';
import { getAgent } from '../../server-agents/get-agent.ts';
import { memberProcedure } from '../server/procedure.ts';

export const getAgentProcedure = memberProcedure
    .input(agentDetailInputSchema)
    .output(agentSchema)
    .query(async ({ ctx, input }) => {
        const agent = await getAgent(ctx.grottoDb, ctx.member, input.serverId, input.agentId);
        if (!agent) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found.' });
        }
        return agent;
    });
