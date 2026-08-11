import {
    hostedAgentActivityHistoryInputSchema,
    hostedAgentActivityHistoryPageSchema,
} from '@tavern/api';
import { listHostedAgentActivityHistory } from '../../hosted-agents/agent-activity-history.ts';
import { requireServerMembership } from '../../servers/server-access.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentActivityHistoryProcedure = memberProcedure
    .input(hostedAgentActivityHistoryInputSchema)
    .output(hostedAgentActivityHistoryPageSchema)
    .query(async ({ ctx, input }) => {
        await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);
        return await listHostedAgentActivityHistory(ctx.grottoDb, input);
    });
