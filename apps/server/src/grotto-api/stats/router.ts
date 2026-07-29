import { createRouter } from '../trpc.ts';
import { getHostedUsageProcedure } from './live.ts';

export const statsRouter = createRouter({
    live: getHostedUsageProcedure,
});
