import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import type { ChatEventInvalidation } from './chat-event-invalidation.ts';
import { useChatEvent } from './use-chat-event-stream.tsx';

/**
 * A read moves unread counts and nothing else, and `chat.list` is where they
 * render, so the transcript itself is left alone.
 */
export function useChatReadEvents() {
    const utils = grottoTrpc.useUtils();

    useChatEvent('chat.read', async (_events, serverId) => {
        await invalidateChatRead({ serverId, utils });
    });
}

export async function invalidateChatRead({
    serverId,
    utils,
}: Pick<ChatEventInvalidation<'chat.read'>, 'serverId' | 'utils'>) {
    await utils.chat.list.invalidate({ serverId });
}
