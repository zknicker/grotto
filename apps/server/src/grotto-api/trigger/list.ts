import { triggerListInputSchema, triggerListSchema } from '@grotto/api';
import { listOperatorTriggers } from '../../triggers/operator-triggers.ts';
import { triggerProcedure } from './procedure.ts';

export const listTriggersProcedure = triggerProcedure
    .input(triggerListInputSchema)
    .output(triggerListSchema)
    .query(async ({ ctx, input }) =>
        listOperatorTriggers(ctx.grottoDb, ctx.member, { ...input, origin: ctx.requestOrigin })
    );
