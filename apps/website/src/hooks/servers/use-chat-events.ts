import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import {
    type ChatEventTargets,
    chatEventBatchWindowMs,
    createChatEventBatch,
    laterEventCursor,
    walkEventCatchUp,
} from './chat-event-cursor.ts';
import { threadMessagesQueryKey } from './use-thread-messages.ts';

export function useChatEvents(serverId: string | undefined) {
    const utils = grottoTrpc.useUtils();
    const queryClient = useQueryClient();
    const eventStateRef = React.useRef({ cursor: '0', serverId });
    const batchRef = React.useRef(createChatEventBatch());
    const batchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    if (eventStateRef.current.serverId !== serverId) {
        eventStateRef.current = { cursor: '0', serverId };
    }

    const invalidateTargets = React.useCallback(
        async (targets: ChatEventTargets) => {
            if (serverId === undefined) {
                return;
            }

            await createChatEventInvalidator({ queryClient, serverId, utils })(targets);
        },
        // The utils proxy root is stable; each `utils.chat.x` access is a fresh
        // object, so depending on paths would rebuild this every render.
        [queryClient, serverId, utils]
    );

    const flushEventBatch = React.useCallback(() => {
        if (batchTimerRef.current !== null) {
            clearTimeout(batchTimerRef.current);
            batchTimerRef.current = null;
        }

        const targets = batchRef.current.drain();
        if (targets) {
            void invalidateTargets(targets);
        }
    }, [invalidateTargets]);

    const refetchServerChatSnapshot = React.useCallback(async () => {
        if (serverId === undefined) {
            return;
        }

        await Promise.all([
            utils.chat.list.invalidate({ serverId }),
            utils.chat.listArchived.invalidate({ serverId }),
            utils.chat.get.invalidate({ serverId }),
            utils.chat.messages.invalidate({ serverId }),
            utils.chat.search.invalidate({ serverId }),
            utils.task.list.invalidate({ serverId }, { refetchType: 'all' }),
            utils.taskLabel.list.invalidate({ serverId }, { refetchType: 'all' }),
        ]);
    }, [serverId, utils]);

    const catchUp = React.useCallback(async () => {
        if (serverId === undefined) {
            return;
        }

        const current = eventStateRef.current;

        if (current.serverId !== serverId) {
            return;
        }

        if (current.cursor === '0') {
            const head = await utils.chat.eventHead.fetch({ serverId });
            eventStateRef.current.cursor = laterEventCursor(
                eventStateRef.current.cursor,
                head.cursor
            );
            await refetchServerChatSnapshot();
            return;
        }

        const walkedCursor = await walkEventCatchUp({
            afterCursor: current.cursor,
            fetchPage: async (afterCursor, limit) =>
                await utils.chat.events.fetch({ afterCursor, limit, serverId }),
            onTargets: invalidateTargets,
        });

        if (eventStateRef.current.serverId === serverId) {
            eventStateRef.current.cursor = laterEventCursor(
                eventStateRef.current.cursor,
                walkedCursor
            );
        }
    }, [invalidateTargets, refetchServerChatSnapshot, serverId, utils]);

    // A pending burst belongs to the Server it arrived on, so leaving that
    // Server — or the app — flushes it instead of dropping it.
    React.useEffect(() => flushEventBatch, [flushEventBatch]);

    grottoTrpc.chat.onEvent.useSubscription(
        { serverId: serverId ?? '' },
        {
            enabled: serverId !== undefined,
            onData: (event) => {
                if (eventStateRef.current.serverId === serverId) {
                    eventStateRef.current.cursor = laterEventCursor(
                        eventStateRef.current.cursor,
                        event.cursor
                    );
                }
                if (batchRef.current.add(event)) {
                    batchTimerRef.current = setTimeout(flushEventBatch, chatEventBatchWindowMs);
                }
            },
            onStarted: () => void catchUp(),
        }
    );
}

/**
 * The single owner of what one Chat event pass invalidates. Kept outside the
 * hook so the mapping from targets to exact queries is directly testable.
 */
export function createChatEventInvalidator({
    queryClient,
    serverId,
    utils,
}: {
    queryClient: QueryClient;
    serverId: string;
    utils: ReturnType<typeof grottoTrpc.useUtils>;
}) {
    return async (targets: ChatEventTargets) => {
        const invalidations: Promise<unknown>[] = [];

        if (targets.invalidateChatList) {
            invalidations.push(utils.chat.list.invalidate({ serverId }));
        }
        if (targets.invalidateAgentChats) {
            invalidations.push(utils.agent.chats.invalidate({ serverId }));
        }
        if (targets.lifecycleChatIds.length > 0) {
            invalidations.push(
                utils.chat.listArchived.invalidate({ serverId }),
                ...targets.lifecycleChatIds.map((chatId) =>
                    utils.chat.get.invalidate({ chatId, serverId })
                )
            );
        }
        if (targets.invalidateSearch) {
            invalidations.push(utils.chat.search.invalidate({ serverId }));
        }
        if (targets.invalidateTasks) {
            invalidations.push(utils.task.list.invalidate({ serverId }, { refetchType: 'all' }));
        }
        if (targets.invalidateTaskLabels) {
            invalidations.push(
                utils.taskLabel.list.invalidate({ serverId }, { refetchType: 'all' })
            );
        }
        invalidations.push(
            ...targets.messageChatIds.map((chatId) =>
                utils.chat.messages.invalidate({ chatId, serverId })
            ),
            ...targets.threadMessageChatIds.map((chatId) =>
                queryClient.invalidateQueries({
                    queryKey: threadMessagesQueryKey(serverId, chatId),
                })
            )
        );

        await Promise.all(invalidations);
    };
}
