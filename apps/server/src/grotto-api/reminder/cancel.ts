import { hostedReminderCancelInputSchema, hostedReminderMutationResultSchema } from '@tavern/api';
import { cancelOperatorReminder } from '../../reminders/operator-reminders.ts';
import { reminderProcedure } from './procedure.ts';

export const cancelReminderProcedure = reminderProcedure
    .input(hostedReminderCancelInputSchema)
    .output(hostedReminderMutationResultSchema)
    .mutation(async ({ ctx, input }) =>
        cancelOperatorReminder(ctx.grottoDb, ctx.member, input, {
            now: () => new Date(),
        })
    );
