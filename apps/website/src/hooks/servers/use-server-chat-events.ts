import type { HostedDurableEvent } from '@tavern/api';
import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { laterHostedEventCursor, walkHostedEventCatchUp } from './server-chat-event-cursor.ts';

export function useServerChatEvents(serverId: string | undefined) {
    const utils = grottoTrpc.useUtils();
    const eventStateRef = React.useRef({ cursor: '0', serverId });

    if (eventStateRef.current.serverId !== serverId) {
        eventStateRef.current = { cursor: '0', serverId };
    }

    const refetchEventTargets = React.useCallback(
        async (events: HostedDurableEvent[]) => {
            if (events.length === 0 || serverId === undefined) {
                return;
            }

            const messageEvents = events.filter((event) => event.type === 'message.created');
            const chatIds = [...new Set(messageEvents.map((event) => event.chatId))];
            const invalidations: Promise<unknown>[] = [utils.chat.list.invalidate({ serverId })];

            if (messageEvents.length > 0) {
                invalidations.push(
                    utils.chat.search.invalidate({ serverId }),
                    ...chatIds.map((chatId) => utils.chat.messages.invalidate({ chatId, serverId }))
                );
            }

            await Promise.all(invalidations);
        },
        [serverId, utils.chat.list, utils.chat.messages, utils.chat.search]
    );

    const refetchServerChatSnapshot = React.useCallback(async () => {
        if (serverId === undefined) {
            return;
        }

        await Promise.all([
            utils.chat.list.invalidate({ serverId }),
            utils.chat.messages.invalidate({ serverId }),
            utils.chat.search.invalidate({ serverId }),
        ]);
    }, [serverId, utils.chat.list, utils.chat.messages, utils.chat.search]);

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
            eventStateRef.current.cursor = laterHostedEventCursor(
                eventStateRef.current.cursor,
                head.cursor
            );
            await refetchServerChatSnapshot();
            return;
        }

        const walkedCursor = await walkHostedEventCatchUp({
            afterCursor: current.cursor,
            fetchPage: async (afterCursor, limit) =>
                await utils.chat.events.fetch({ afterCursor, limit, serverId }),
            onEvents: refetchEventTargets,
        });

        if (eventStateRef.current.serverId === serverId) {
            eventStateRef.current.cursor = laterHostedEventCursor(
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
                    eventStateRef.current.cursor = laterHostedEventCursor(
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
