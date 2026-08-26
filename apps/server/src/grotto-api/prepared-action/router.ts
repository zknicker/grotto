import { createRouter } from '../trpc.ts';
import { commitPreparedActionProcedure } from './commit.ts';

export const preparedActionRouter = createRouter({
    commit: commitPreparedActionProcedure,
});
