import { reminderChangesInputSchema, reminderChangesSchema } from '@tavern/api';
import { listOperatorReminderChanges } from '../../reminders/operator-reminders.ts';
import { reminderProcedure } from './procedure.ts';

export const listReminderChangesProcedure = reminderProcedure
    .input(reminderChangesInputSchema)
    .output(reminderChangesSchema)
    .query(async ({ ctx, input }) => listOperatorReminderChanges(ctx.grottoDb, ctx.member, input));
