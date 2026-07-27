import { createRouter } from '../trpc.ts';
import { getThreadProcedure } from './get.ts';
import { setThreadFollowProcedure } from './set-follow.ts';

export const threadRouter = createRouter({
    get: getThreadProcedure,
    setFollow: setThreadFollowProcedure,
});
