import { reminderListInputSchema, reminderListSchema } from '@grotto/api';
import { listOperatorReminders } from '../../reminders/operator-reminders.ts';
import { reminderProcedure } from './procedure.ts';

export const listRemindersProcedure = reminderProcedure
    .input(reminderListInputSchema)
    .output(reminderListSchema)
    .query(async ({ ctx, input }) => listOperatorReminders(ctx.grottoDb, ctx.member, input));
