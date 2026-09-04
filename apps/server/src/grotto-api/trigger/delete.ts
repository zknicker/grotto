import { triggerDeleteInputSchema, triggerDeleteResultSchema } from '@grotto/api';
import { deleteOperatorTrigger } from '../../triggers/operator-triggers.ts';
import { triggerProcedure } from './procedure.ts';

/** Deleting cascades the fire history; the Chat receipts it already wrote stay. */
export const deleteTriggerProcedure = triggerProcedure
    .input(triggerDeleteInputSchema)
    .output(triggerDeleteResultSchema)
    .mutation(async ({ ctx, input }) =>
        deleteOperatorTrigger(ctx.grottoDb, ctx.member, { ...input, origin: ctx.requestOrigin })
    );
