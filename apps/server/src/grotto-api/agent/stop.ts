import { hostedAgentDeliveryControlInputSchema, hostedAgentDeliveryStateSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import {
    assertAgentDeliveryAccess,
    readHostedAgentDeliveryState,
} from '../../hosted-agents/agent-delivery-control.ts';
import { memberProcedure } from '../server/procedure.ts';
import { emitServerUpdated } from '../server-events.ts';

export const stopAgentProcedure = memberProcedure
    .input(hostedAgentDeliveryControlInputSchema)
    .output(hostedAgentDeliveryStateSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            await assertAgentDeliveryAccess(ctx.grottoDb, ctx.member, input);
            await ctx.agentDelivery.stop(input);
            emitServerUpdated({
                agentId: input.agentId,
                scope: 'agent',
                serverId: input.serverId,
            });
            return await readHostedAgentDeliveryState(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
