import { agentActivityHistoryInputSchema, agentActivityHistoryPageSchema } from '@grotto/api';
import { listAgentActivityHistory } from '../../server-agents/agent-activity-history.ts';
import { requireServerMembership } from '../../servers/server-access.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentActivityHistoryProcedure = memberProcedure
    .input(agentActivityHistoryInputSchema)
    .output(agentActivityHistoryPageSchema)
    .query(async ({ ctx, input }) => {
        await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);
        return await listAgentActivityHistory(ctx.grottoDb, input);
    });
