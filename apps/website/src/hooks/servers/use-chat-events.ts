import { useQueryClient } from '@tanstack/react-query';
import type { HostedDurableEvent } from '@tavern/api';
import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { eventRefetchTargets, laterEventCursor, walkEventCatchUp } from './chat-event-cursor.ts';
import { threadMessagesQueryKey } from './use-thread-messages.ts';

export function useChatEvents(serverId: string | undefined) {
    const utils = grottoTrpc.useUtils();
    const queryClient = useQueryClient();
    const eventStateRef = React.useRef({ cursor: '0', serverId });

    if (eventStateRef.current.serverId !== serverId) {
        eventStateRef.current = { cursor: '0', serverId };
    }

    const refetchEventTargets = React.useCallback(
        async (events: HostedDurableEvent[]) => {
            if (events.length === 0 || serverId === undefined) {
                return;
            }

            const targets = eventRefetchTargets(events);
            const invalidations: Promise<unknown>[] = [utils.chat.list.invalidate({ serverId })];

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
                invalidations.push(
                    utils.task.list.invalidate({ serverId }, { refetchType: 'all' })
                );
            }
            if (targets.invalidateTaskLabels) {
                invalidations.push(
                    utils.taskLabel.list.invalidate({ serverId }, { refetchType: 'all' })
                );
            }
            invalidations.push(
                ...[...new Set([...targets.messageChatIds, ...targets.parentChatIds])].map(
                    (chatId) => utils.chat.messages.invalidate({ chatId, serverId })
                ),
                ...targets.messageChatIds.map((chatId) =>
                    queryClient.invalidateQueries({
                        queryKey: threadMessagesQueryKey(serverId, chatId),
                    })
                )
            );

            await Promise.all(invalidations);
        },
        [
            serverId,
            queryClient,
            utils.chat.get,
            utils.chat.list,
            utils.chat.listArchived,
            utils.chat.messages,
            utils.chat.search,
            utils.task.list,
            utils.taskLabel.list,
        ]
    );

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
    }, [
        serverId,
        utils.chat.list,
        utils.chat.listArchived,
        utils.chat.get,
        utils.chat.messages,
        utils.chat.search,
        utils.task.list,
        utils.taskLabel.list,
    ]);

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
            onEvents: refetchEventTargets,
        });

        if (eventStateRef.current.serverId === serverId) {
            eventStateRef.current.cursor = laterEventCursor(
                eventStateRef.current.cursor,
                walkedCursor
            );
        }
    }, [
        refetchEventTargets,
        refetchServerChatSnapshot,
        serverId,
        utils.chat.eventHead,
        utils.chat.events,
    ]);

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
                void refetchEventTargets([event]);
            },
            onStarted: () => void catchUp(),
        }
    );
}
