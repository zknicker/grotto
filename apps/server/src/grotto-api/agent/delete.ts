import { hostedDeleteAgentInputSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { emitDurableChatEvent } from '../../chats/durable-events.ts';
import { AgentDeleteDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import { deleteHostedAgent } from '../../hosted-agents/delete-agent.ts';
import { memberProcedure } from '../server/procedure.ts';
import { emitServerUpdated } from '../server-events.ts';

export const deleteAgentProcedure = memberProcedure
    .input(hostedDeleteAgentInputSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            const result = await deleteHostedAgent(ctx.grottoDb, ctx.member, input);
            for (const event of result.taskEvents) {
                emitDurableChatEvent({ audienceUserId: null, event });
            }
            ctx.agentDelivery.retireAgent({
                agentId: result.agentId,
                computerId: result.computerId,
            });
            emitServerUpdated({ scope: 'agent', serverId: input.serverId });
            return { agentId: result.agentId };
        } catch (cause) {
            if (cause instanceof AgentDeleteDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
