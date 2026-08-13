import { createRouter } from '../trpc.ts';
import { getUsageProcedure } from './live.ts';

export const statsRouter = createRouter({
    live: getUsageProcedure,
});
