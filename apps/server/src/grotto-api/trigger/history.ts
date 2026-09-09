import { triggerHistoryInputSchema, triggerHistorySchema } from '@grotto/api';
import { listOperatorTriggerHistory } from '../../triggers/trigger-history.ts';
import { triggerProcedure } from './procedure.ts';

export const listTriggerHistoryProcedure = triggerProcedure
    .input(triggerHistoryInputSchema)
    .output(triggerHistorySchema)
    .query(async ({ ctx, input }) => listOperatorTriggerHistory(ctx.grottoDb, ctx.member, input));
