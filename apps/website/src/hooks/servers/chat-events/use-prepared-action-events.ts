import { useQueryClient } from '@tanstack/react-query';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { threadMessagesQueryKey } from '../use-thread-messages.ts';
import { type ChatEventInvalidation, uniqueChatIds } from './chat-event-invalidation.ts';
import { useChatEvent } from './use-chat-event-stream.tsx';

/** Refetches action-bearing messages when a proposal changes lifecycle state. */
export function usePreparedActionEvents() {
    const queryClient = useQueryClient();
    const utils = grottoTrpc.useUtils();

    useChatEvent('prepared-action.updated', async (events, serverId) => {
        await invalidatePreparedActionEvents({ events, queryClient, serverId, utils });
    });
}

export async function invalidatePreparedActionEvents({
    events,
    queryClient,
    serverId,
    utils,
}: ChatEventInvalidation<'prepared-action.updated'>) {
    const chatIds = uniqueChatIds(
        events.flatMap((event) =>
            event.parentChatId ? [event.chatId, event.parentChatId] : [event.chatId]
        )
    );

    await Promise.all([
        utils.chat.search.invalidate({ serverId }),
        ...chatIds.map((chatId) => utils.chat.messages.invalidate({ chatId, serverId })),
        ...uniqueChatIds(events.map((event) => event.chatId)).map((chatId) =>
            queryClient.invalidateQueries({ queryKey: threadMessagesQueryKey(serverId, chatId) })
        ),
    ]);
}
