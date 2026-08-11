import { hostedAgentSchema, hostedUpdateAgentProfileInputSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import { updateHostedAgentProfile } from '../../hosted-agents/update-agent-profile.ts';
import { memberProcedure } from '../server/procedure.ts';
import { emitServerUpdated } from '../server-events.ts';

export const updateAgentProfileProcedure = memberProcedure
    .input(hostedUpdateAgentProfileInputSchema)
    .output(hostedAgentSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            const agent = await updateHostedAgentProfile(ctx.grottoDb, ctx.member, input);
            await ctx.agentDelivery.configureAgent({
                agentDescription: agent.description,
                agentId: agent.id,
                agentName: agent.displayName,
                computerId: agent.computerId,
                modelId: agent.desiredModelId,
                runtimeId: agent.desiredRuntimeId,
            });
            emitServerUpdated({ agentId: agent.id, scope: 'agent', serverId: input.serverId });
            return agent;
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
