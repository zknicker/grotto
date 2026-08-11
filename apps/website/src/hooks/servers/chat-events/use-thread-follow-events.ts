import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { type ChatEventInvalidation, uniqueChatIds } from './chat-event-invalidation.ts';
import { useChatEvent } from './use-chat-event-stream.tsx';

/**
 * Follow state drives Thread attention, which parent unread counts include, so
 * a follow change moves the Chat list and the parent Chat's summary.
 */
export function useThreadFollowEvents() {
    const utils = grottoTrpc.useUtils();

    useChatEvent('thread.follow.updated', async (events, serverId) => {
        await invalidateThreadFollow({ events, serverId, utils });
    });
}

export async function invalidateThreadFollow({
    events,
    serverId,
    utils,
}: Omit<ChatEventInvalidation<'thread.follow.updated'>, 'queryClient'>) {
    const parentChatIds = uniqueChatIds(events.map((event) => event.parentChatId));

    await Promise.all([
        utils.chat.list.invalidate({ serverId }),
        ...parentChatIds.map((chatId) => utils.chat.messages.invalidate({ chatId, serverId })),
    ]);
}
