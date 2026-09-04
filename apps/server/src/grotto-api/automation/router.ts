import { createRouter } from '../trpc.ts';
import { automationFireContextProcedure } from './fire-context.ts';

export const automationRouter = createRouter({
    fireContext: automationFireContextProcedure,
});
