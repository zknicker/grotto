import { reminderCancelInputSchema, reminderMutationResultSchema } from '@grotto/api';
import { cancelOperatorReminder } from '../../reminders/operator-reminders.ts';
import { reminderProcedure } from './procedure.ts';

export const cancelReminderProcedure = reminderProcedure
    .input(reminderCancelInputSchema)
    .output(reminderMutationResultSchema)
    .mutation(async ({ ctx, input }) =>
        cancelOperatorReminder(ctx.grottoDb, ctx.member, input, {
            now: () => new Date(),
        })
    );
