import { reminderChangedEventSchema, reminderEventSubscriptionInputSchema } from '@grotto/api';
import { TRPCError } from '@trpc/server';
import { subscribeToDurableChatEvents } from '../../chats/durable-events.ts';
import {
    ReminderOperatorAccessDeniedError,
    requireReminderOperator,
} from '../../reminders/operator-reminders.ts';
import { toMembershipLossError } from '../server/membership-loss.ts';
import { reminderProcedure } from './procedure.ts';

export const onReminderEventProcedure = reminderProcedure
    .input(reminderEventSubscriptionInputSchema)
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
            try {
                await requireReminderOperator(ctx.grottoDb, ctx.member, input.serverId);
            } catch (cause) {
                const refusal = toMembershipLossError(cause);
                if (!refusal) {
                    if (cause instanceof ReminderOperatorAccessDeniedError) {
                        throw new TRPCError({
                            cause,
                            code: 'FORBIDDEN',
                            message: cause.message,
                        });
                    }
                    throw cause;
                }
                throw refusal;
            }
            yield reminderChangedEventSchema.parse(event);
        }
    });
