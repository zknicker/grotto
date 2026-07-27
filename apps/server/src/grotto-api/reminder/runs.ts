import { hostedReminderRunsInputSchema, hostedReminderRunsSchema } from '@tavern/api';
import { listOperatorReminderRuns } from '../../reminders/operator-reminders.ts';
import { reminderProcedure } from './procedure.ts';

export const listReminderRunsProcedure = reminderProcedure
    .input(hostedReminderRunsInputSchema)
    .output(hostedReminderRunsSchema)
    .query(async ({ ctx, input }) => listOperatorReminderRuns(ctx.grottoDb, ctx.member, input));
