import { hostedAgentActivityInputSchema, hostedAgentActivitySchema } from '@tavern/api';
import { listHostedAgentActivity } from '../../hosted-agents/list-agent-activity.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentActivityProcedure = memberProcedure
    .input(hostedAgentActivityInputSchema)
    .output(hostedAgentActivitySchema)
    .query(({ ctx, input }) => listHostedAgentActivity(ctx.grottoDb, ctx.member, input));
