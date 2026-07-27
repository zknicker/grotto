import { hostedAgentSchema, hostedConfigureAgentInputSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import { configureHostedAgent } from '../../hosted-agents/configure-agent.ts';
import { memberProcedure } from '../server/procedure.ts';

export const configureAgentProcedure = memberProcedure
    .input(hostedConfigureAgentInputSchema)
    .output(hostedAgentSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            return await configureHostedAgent(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
