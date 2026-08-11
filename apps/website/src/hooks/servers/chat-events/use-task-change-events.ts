import { useQueryClient } from '@tanstack/react-query';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { threadMessagesQueryKey } from '../use-thread-messages.ts';
import { type ChatEventInvalidation, uniqueChatIds } from './chat-event-invalidation.ts';
import { useChatEvent } from './use-chat-event-stream.tsx';

/**
 * Creating or changing a Task moves the Server task list and the transcript the
 * Task was raised in, but not Chat ordering. Both kinds are one lane, so a
 * burst carrying each still costs one pass.
 */
const taskEventTypes = ['task.created', 'task.updated'] as const;

export function useTaskChangeEvents() {
    const queryClient = useQueryClient();
    const utils = grottoTrpc.useUtils();

    useChatEvent(taskEventTypes, async (events, serverId) => {
        await invalidateTaskChanges({ events, queryClient, serverId, utils });
    });
}

export async function invalidateTaskChanges({
    events,
    queryClient,
    serverId,
    utils,
}: ChatEventInvalidation<'task.created' | 'task.updated'>) {
    const taskChatIds = uniqueChatIds(events.map((event) => event.chatId));

    await Promise.all([
        utils.task.list.invalidate({ serverId }, { refetchType: 'all' }),
        ...taskChatIds.map((chatId) => utils.chat.messages.invalidate({ chatId, serverId })),
        ...taskChatIds.map((chatId) =>
            queryClient.invalidateQueries({ queryKey: threadMessagesQueryKey(serverId, chatId) })
        ),
    ]);
}
