import { hostedServerStatsInputSchema, hostedServerUsageOverviewSchema } from '@tavern/api';
import { readHostedServerUsage } from '../../hosted-operations/computer-usage.ts';
import { memberProcedure } from '../server/procedure.ts';

export const getHostedUsageProcedure = memberProcedure
    .input(hostedServerStatsInputSchema)
    .output(hostedServerUsageOverviewSchema)
    .query(({ ctx, input }) => readHostedServerUsage(ctx.grottoDb, ctx.member, input.serverId));
