import { hostedReminderListInputSchema, hostedReminderListSchema } from '@tavern/api';
import { listOperatorReminders } from '../../reminders/operator-reminders.ts';
import { reminderProcedure } from './procedure.ts';

export const listRemindersProcedure = reminderProcedure
    .input(hostedReminderListInputSchema)
    .output(hostedReminderListSchema)
    .query(async ({ ctx, input }) => listOperatorReminders(ctx.grottoDb, ctx.member, input));
