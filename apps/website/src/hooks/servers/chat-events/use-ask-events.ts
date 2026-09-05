import { useQueryClient } from '@tanstack/react-query';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { threadMessagesQueryKey } from '../use-thread-messages.ts';
import { type ChatEventInvalidation, uniqueChatIds } from './chat-event-invalidation.ts';
import { useChatEvent } from './use-chat-event-stream.tsx';

/**
 * An Ask created or settled moves two reads: the viewer's open-Ask list behind
 * the Inbox, and the transcript carrying the Ask Message whose marker states
 * the new status. A settlement happens inside a Thread, so the parent Chat's
 * transcript refetches beside it.
 */
export function useAskEvents() {
    const queryClient = useQueryClient();
    const utils = grottoTrpc.useUtils();

    useChatEvent('ask.updated', async (events, serverId) => {
        await invalidateAskChanges({ events, queryClient, serverId, utils });
    });
}

export async function invalidateAskChanges({
    events,
    queryClient,
    serverId,
    utils,
}: ChatEventInvalidation<'ask.updated'>) {
    const chatIds = uniqueChatIds(
        events.flatMap((event) =>
            event.parentChatId ? [event.chatId, event.parentChatId] : [event.chatId]
        )
    );

    await Promise.all([
        utils.ask.listOpen.invalidate({ serverId }),
        ...chatIds.map((chatId) => utils.chat.messages.invalidate({ chatId, serverId })),
        ...uniqueChatIds(events.map((event) => event.chatId)).map((chatId) =>
            queryClient.invalidateQueries({ queryKey: threadMessagesQueryKey(serverId, chatId) })
        ),
    ]);
}
