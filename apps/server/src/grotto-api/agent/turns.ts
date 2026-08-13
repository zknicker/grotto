import { hostedAgentTurnsInputSchema, hostedAgentTurnsSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import { AgentConfigDeniedError } from '../../hosted-agents/agent-config-errors.ts';
import { listHostedAgentTurns } from '../../hosted-agents/list-agent-turns.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentTurnsProcedure = memberProcedure
    .input(hostedAgentTurnsInputSchema)
    .output(hostedAgentTurnsSchema)
    .query(async ({ ctx, input }) => {
        try {
            return await listHostedAgentTurns(ctx.grottoDb, ctx.member, input);
        } catch (cause) {
            if (cause instanceof AgentConfigDeniedError) {
                throw new TRPCError({ cause, code: 'NOT_FOUND', message: cause.message });
            }
            throw cause;
        }
    });
