import { agentActivityInputSchema, agentActivitySchema } from '@grotto/api';
import { listAgentActivity } from '../../server-agents/list-agent-activity.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentActivityProcedure = memberProcedure
    .input(agentActivityInputSchema)
    .output(agentActivitySchema)
    .query(({ ctx, input }) => listAgentActivity(ctx.grottoDb, ctx.member, input));
