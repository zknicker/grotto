import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function useChatRead(input: {
    chatId: string | undefined;
    enabled?: boolean;
    sequence: number | undefined;
    serverId: string | undefined;
}) {
    // The durable `chat.read` event owns unread-count invalidation; see useChatEvents.
    const mutation = grottoTrpc.chat.markRead.useMutation();
    const mutate = mutation.mutate;
    const lastMarkedRef = React.useRef<string | null>(null);
    const viewKey =
        (input.enabled ?? true) &&
        input.chatId !== undefined &&
        input.sequence !== undefined &&
        input.serverId !== undefined
            ? `${input.serverId}:${input.chatId}:${input.sequence}`
            : null;

    React.useEffect(() => {
        if (!viewKey || viewKey === lastMarkedRef.current) {
            return;
        }

        lastMarkedRef.current = viewKey;
        mutate({
            chatId: input.chatId as string,
            sequence: input.sequence as number,
            serverId: input.serverId as string,
        });
    }, [input.chatId, input.sequence, input.serverId, mutate, viewKey]);

    return mutation;
}
