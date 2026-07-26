import type { HostedCompositionEvent } from '@tavern/api';
import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useServerChatComposition(serverId: string | undefined, chatId: string | undefined) {
    const scope = `${serverId ?? ''}:${chatId ?? ''}`;
    const [compositionState, setCompositionState] = React.useState<{
        events: HostedCompositionEvent[];
        scope: string;
    }>({ events: [], scope });
    const publish = grottoTrpc.chat.publishComposition.useMutation();
    const compositions = compositionState.scope === scope ? compositionState.events : [];

    grottoTrpc.chat.onComposition.useSubscription(
        { chatId: chatId ?? '', serverId: serverId ?? '' },
        {
            enabled: serverId !== undefined && chatId !== undefined,
            onData: (event) => {
                setCompositionState((current) => {
                    const currentEvents = current.scope === scope ? current.events : [];
                    const withoutActor = currentEvents.filter(
                        (composition) => composition.actorUserId !== event.actorUserId
                    );
                    return {
                        events: event.text === null ? withoutActor : [...withoutActor, event],
                        scope,
                    };
                });
            },
        }
    );

    return { compositions, publish };
}
