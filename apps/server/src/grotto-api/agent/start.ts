import { hostedAgentDeliveryControlInputSchema, hostedAgentDeliveryStateSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import {
    assertAgentDeliveryAccess,
    readHostedAgentDeliveryState,
} from '../../hosted-agents/agent-delivery-control.ts';
import { memberProcedure } from '../server/procedure.ts';

export const startAgentProcedure = memberProcedure
    .input(hostedAgentDeliveryControlInputSchema)
    .output(hostedAgentDeliveryStateSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            await assertAgentDeliveryAccess(ctx.grottoDb, ctx.member, input);
            await ctx.agentDelivery.start(input);
            return await readHostedAgentDeliveryState(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
