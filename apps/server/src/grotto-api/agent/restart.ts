import { agentDeliveryControlInputSchema, agentDeliveryStateSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../server-agents/agent-config-errors.ts';
import {
    assertAgentDeliveryAccess,
    readAgentDeliveryState,
} from '../../server-agents/agent-delivery-control.ts';
import { memberProcedure } from '../server/procedure.ts';
import { emitServerUpdated } from '../server-events.ts';

export const restartAgentProcedure = memberProcedure
    .input(agentDeliveryControlInputSchema)
    .output(agentDeliveryStateSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            await assertAgentDeliveryAccess(ctx.grottoDb, ctx.member, input);
            await ctx.agentDelivery.restart(input);
            emitServerUpdated({
                agentId: input.agentId,
                scope: 'agent',
                serverId: input.serverId,
            });
            return await readAgentDeliveryState(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
