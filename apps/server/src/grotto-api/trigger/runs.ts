import { triggerRunsInputSchema, triggerRunsSchema } from '@grotto/api';
import { listOperatorTriggerRuns } from '../../triggers/operator-triggers.ts';
import { triggerProcedure } from './procedure.ts';

export const listTriggerRunsProcedure = triggerProcedure
    .input(triggerRunsInputSchema)
    .output(triggerRunsSchema)
    .query(async ({ ctx, input }) =>
        listOperatorTriggerRuns(ctx.grottoDb, ctx.member, { ...input, origin: ctx.requestOrigin })
    );
