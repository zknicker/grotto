import { agentCreatedSchema, createAgentInputSchema } from '@grotto/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../server-agents/agent-config-errors.ts';
import { createAgent } from '../../server-agents/create-agent.ts';
import { memberProcedure } from '../server/procedure.ts';
import { emitServerUpdated } from '../server-events.ts';

export const createAgentProcedure = memberProcedure
    .input(createAgentInputSchema)
    .output(agentCreatedSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            const created = await createAgent(ctx.grottoDb, ctx.member, input);
            await ctx.agentDelivery.configureAgent({
                agentDescription: created.agent.description,
                agentId: created.agent.id,
                agentName: created.agent.displayName,
                computerId: created.agent.computerId,
                modelId: created.agent.desiredModelId,
                runtimeId: created.agent.desiredRuntimeId,
            });
            emitServerUpdated({
                agentId: created.agent.id,
                scope: 'agent',
                serverId: input.serverId,
            });
            return created;
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
