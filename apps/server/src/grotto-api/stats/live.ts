import { serverStatsInputSchema, serverUsageOverviewSchema } from '@grotto/api';
import { readServerUsage } from '../../server-operations/computer-usage.ts';
import { memberProcedure } from '../server/procedure.ts';

export const getUsageProcedure = memberProcedure
    .input(serverStatsInputSchema)
    .output(serverUsageOverviewSchema)
    .query(({ ctx, input }) => readServerUsage(ctx.grottoDb, ctx.member, input.serverId));
