import type { HostedReminderChangedEvent } from '@tavern/api';
import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { catchUpReminderChanges, laterReminderCursor } from './server-reminder-event-cursor.ts';

export type ServerReminderConnectionState = 'connected' | 'connecting' | 'reconnecting';

export function useServerReminderEvents(serverId: string) {
    const utils = grottoTrpc.useUtils();
    const stateRef = React.useRef({ cursor: '0', serverId });
    const [connectionState, setConnectionState] =
        React.useState<ServerReminderConnectionState>('connecting');
    if (stateRef.current.serverId !== serverId) {
        stateRef.current = { cursor: '0', serverId };
    }

    const invalidateSnapshot = React.useCallback(async () => {
        await Promise.all([
            utils.reminder.list.invalidate({ serverId }),
            utils.reminder.runs.invalidate({ serverId }),
        ]);
    }, [serverId, utils.reminder.list, utils.reminder.runs]);
    const invalidate = React.useCallback(
        async (events: HostedReminderChangedEvent[]) => {
            if (events.length > 0) {
                await invalidateSnapshot();
            }
        },
        [invalidateSnapshot]
    );
    const catchUp = React.useCallback(async () => {
        const current = stateRef.current;
        if (current.serverId !== serverId) {
            return;
        }
        const cursor = await catchUpReminderChanges({
            afterCursor: current.cursor,
            fetchHead: async () =>
                await utils.chat.eventHead
                    .fetch({ serverId })
                    .then((eventHead) => eventHead.cursor),
            fetchPage: async (afterCursor, limit) =>
                await utils.reminder.changes.fetch({
                    afterCursor,
                    limit,
                    serverId,
                }),
            onEvents: invalidate,
            onSnapshot: invalidateSnapshot,
        });
        if (stateRef.current.serverId === serverId) {
            stateRef.current.cursor = laterReminderCursor(stateRef.current.cursor, cursor);
        }
    }, [invalidate, invalidateSnapshot, serverId, utils.chat.eventHead, utils.reminder.changes]);

    grottoTrpc.reminder.onEvent.useSubscription(
        { serverId },
        {
            onData: (event) => {
                stateRef.current.cursor = laterReminderCursor(
                    stateRef.current.cursor,
                    event.cursor
                );
                void invalidate([event]);
            },
            onError: () => setConnectionState('reconnecting'),
            onStarted: () => {
                setConnectionState('connected');
                void catchUp();
            },
        }
    );

    return connectionState;
}
