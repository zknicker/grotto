import {
    hostedAgentActiveActivityInputSchema,
    hostedAgentActiveActivitySnapshotSchema,
} from '@tavern/api';
import { readHostedActiveAgentActivity } from '../../hosted-agents/agent-activity-history.ts';
import { requireServerMembership } from '../../servers/server-access.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentActiveActivityProcedure = memberProcedure
    .input(hostedAgentActiveActivityInputSchema)
    .output(hostedAgentActiveActivitySnapshotSchema)
    .query(async ({ ctx, input }) => {
        await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);
        return await readHostedActiveAgentActivity(ctx.grottoDb, input.serverId);
    });
