import {
    hostedReminderChangedEventSchema,
    hostedReminderEventSubscriptionInputSchema,
} from '@tavern/api';
import { subscribeToDurableChatEvents } from '../../chats/durable-events.ts';
import { requireReminderOperator } from '../../reminders/operator-reminders.ts';
import { reminderProcedure } from './procedure.ts';

export const onReminderEventProcedure = reminderProcedure
    .input(hostedReminderEventSubscriptionInputSchema)
    .use(async ({ ctx, input, next }) => {
        await requireReminderOperator(ctx.grottoDb, ctx.member, input.serverId);
        return next();
    })
    .subscription(async function* ({ ctx, input, signal }) {
        for await (const notification of subscribeToDurableChatEvents(signal)) {
            const { event } = notification;
            if (event.serverId !== input.serverId || event.type !== 'reminder.changed') {
                continue;
            }
            await requireReminderOperator(ctx.grottoDb, ctx.member, input.serverId);
            yield hostedReminderChangedEventSchema.parse(event);
        }
    });
