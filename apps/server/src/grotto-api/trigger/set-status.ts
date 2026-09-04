import { triggerResultSchema, triggerSetStatusInputSchema } from '@grotto/api';
import { setOperatorTriggerStatus } from '../../triggers/operator-triggers.ts';
import { triggerClock, triggerProcedure } from './procedure.ts';

/** Arm or disable. Setting the status a Trigger already has returns it unchanged. */
export const setTriggerStatusProcedure = triggerProcedure
    .input(triggerSetStatusInputSchema)
    .output(triggerResultSchema)
    .mutation(async ({ ctx, input }) =>
        setOperatorTriggerStatus(
            ctx.grottoDb,
            ctx.member,
            { ...input, origin: ctx.requestOrigin },
            triggerClock
        )
    );
