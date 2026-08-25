import { reminderRunsInputSchema, reminderRunsSchema } from '@grotto/api';
import { listOperatorReminderRuns } from '../../reminders/operator-reminders.ts';
import { reminderProcedure } from './procedure.ts';

export const listReminderRunsProcedure = reminderProcedure
    .input(reminderRunsInputSchema)
    .output(reminderRunsSchema)
    .query(async ({ ctx, input }) => listOperatorReminderRuns(ctx.grottoDb, ctx.member, input));
