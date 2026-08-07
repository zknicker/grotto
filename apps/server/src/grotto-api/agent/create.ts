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
            const created = await createHostedAgent(ctx.grottoDb, ctx.member, input);
            await ctx.agentDelivery.configureAgent({
                agentDescription: created.agent.description,
                agentId: created.agent.id,
                agentName: created.agent.displayName,
                computerId: created.agent.computerId,
                modelId: created.agent.desiredModelId,
                runtimeId: created.agent.desiredRuntimeId,
            });
            return created;
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
