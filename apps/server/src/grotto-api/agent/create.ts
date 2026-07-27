import { hostedAgentCreatedSchema, hostedCreateAgentInputSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import { createHostedAgent } from '../../hosted-agents/create-agent.ts';
import { memberProcedure } from '../server/procedure.ts';

export const createAgentProcedure = memberProcedure
    .input(hostedCreateAgentInputSchema)
    .output(hostedAgentCreatedSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            return await createHostedAgent(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
