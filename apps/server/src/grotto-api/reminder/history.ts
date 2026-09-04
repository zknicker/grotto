import { reminderHistoryInputSchema, reminderHistorySchema } from '@grotto/api';
import { listOperatorReminderHistory } from '../../reminders/reminder-history.ts';
import { reminderProcedure } from './procedure.ts';

export const listReminderHistoryProcedure = reminderProcedure
    .input(reminderHistoryInputSchema)
    .output(reminderHistorySchema)
    .query(async ({ ctx, input }) => listOperatorReminderHistory(ctx.grottoDb, ctx.member, input));
