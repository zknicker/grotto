import { createRouter } from '../trpc.ts';
import { cancelReminderProcedure } from './cancel.ts';
import { listReminderChangesProcedure } from './changes.ts';
import { listRemindersProcedure } from './list.ts';
import { onReminderEventProcedure } from './on-event.ts';
import { listReminderRunsProcedure } from './runs.ts';

export const reminderRouter = createRouter({
    cancel: cancelReminderProcedure,
    changes: listReminderChangesProcedure,
    list: listRemindersProcedure,
    onEvent: onReminderEventProcedure,
    runs: listReminderRunsProcedure,
});
