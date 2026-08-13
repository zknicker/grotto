import { agentSchema, configureAgentInputSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../server-agents/agent-config-errors.ts';
import { configureAgent } from '../../server-agents/configure-agent.ts';
import { memberProcedure } from '../server/procedure.ts';
import { emitServerUpdated } from '../server-events.ts';

export const configureAgentProcedure = memberProcedure
    .input(configureAgentInputSchema)
    .output(agentSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            const result = await configureAgent(ctx.grottoDb, ctx.member, input);
            await ctx.agentDelivery.applyAgentConfiguration({
                agent: result.agent,
                rotation: result.rotation,
            });
            emitServerUpdated({
                agentId: result.agent.id,
                scope: 'agent',
                serverId: input.serverId,
            });
            return result.agent;
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
