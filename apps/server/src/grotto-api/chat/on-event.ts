import { chatEventSubscriptionInputSchema, serverdurableeventSchema } from '@grotto/api';
import { findChatAccess } from '../../chats/chat-access.ts';
import { subscribeToDurableChatEvents } from '../../chats/durable-events.ts';
import { requireServerMembership } from '../../servers/server-access.ts';
import { chatProcedure } from './procedure.ts';

export const onChatEventProcedure = chatProcedure
    .input(chatEventSubscriptionInputSchema)
    .use(async ({ ctx, input, next }) => {
        await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);
        return await next();
    })
    .subscription(async function* ({ ctx, input, signal }) {
        for await (const notification of subscribeToDurableChatEvents(signal)) {
            const { event } = notification;

            if (
                event.serverId !== input.serverId ||
                (notification.audienceUserId !== null &&
                    notification.audienceUserId !== ctx.member?.id)
            ) {
                continue;
            }

            await requireServerMembership(ctx.grottoDb, ctx.member, input.serverId);

            if (!ctx.member) {
                continue;
            }

            if (event.type === 'task.label.updated') {
                yield serverdurableeventSchema.parse(event);
                continue;
            }

            const chat = await findChatAccess(ctx.grottoDb, ctx.member.id, {
                chatId: event.chatId,
                serverId: event.serverId,
            });

            if (!chat) {
                continue;
            }

            yield serverdurableeventSchema.parse(event);
        }
    });
