import { createRouter } from '../trpc.ts';
import { listOpenAsksProcedure } from './list-open.ts';

/**
 * Asks are read-only to humans. The answer is an ordinary Message sent into the
 * Ask's Thread, so there is deliberately no answer procedure here.
 */
export const askRouter = createRouter({
    listOpen: listOpenAsksProcedure,
});
