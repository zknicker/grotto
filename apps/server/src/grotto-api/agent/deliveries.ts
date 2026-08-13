import { hostedAgentDeliveriesInputSchema, hostedAgentDeliveriesSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import { listHostedAgentDeliveries } from '../../hosted-agents/list-agent-deliveries.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentDeliveriesProcedure = memberProcedure
    .input(hostedAgentDeliveriesInputSchema)
    .output(hostedAgentDeliveriesSchema)
    .query(async ({ ctx, input }) => {
        try {
            return await listHostedAgentDeliveries(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'NOT_FOUND', message: cause.message });
            }
            throw cause;
        }
    });
