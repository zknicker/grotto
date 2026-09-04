import { triggerCreateInputSchema, triggerSecretResultSchema } from '@grotto/api';
import { createOperatorTrigger } from '../../triggers/operator-trigger-create.ts';
import { triggerClock, triggerProcedure } from './procedure.ts';

/** The only operator response besides `rotate` that carries a readable secret. */
export const createTriggerProcedure = triggerProcedure
    .input(triggerCreateInputSchema)
    .output(triggerSecretResultSchema)
    .mutation(async ({ ctx, input }) =>
        createOperatorTrigger(
            ctx.grottoDb,
            ctx.member,
            { ...input, origin: ctx.requestOrigin },
            triggerClock
        )
    );
