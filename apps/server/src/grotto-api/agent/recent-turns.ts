import { agentRecentTurnsInputSchema, agentRecentTurnsSchema } from '@grotto/api';
import { listRecentAgentTurns } from '../../server-agents/list-recent-agent-turns.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentRecentTurnsProcedure = memberProcedure
    .input(agentRecentTurnsInputSchema)
    .output(agentRecentTurnsSchema)
    .query(({ ctx, input }) => listRecentAgentTurns(ctx.grottoDb, ctx.member, input));
