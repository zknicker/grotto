import { useQueryClient } from '@tanstack/react-query';
import type { HostedDurableEvent } from '@tavern/api';
import {
    type ChatEventHandler,
    type ChatEventRegistry,
    type ChatEventType,
    chatEventBatchWindowMs,
    chatMessagePagesQueryKey,
    createChatEventBatch,
    createChatEventRegistry,
    grottoTrpc,
    laterEventCursor,
    walkEventCatchUp,
} from '@tavern/app-client';
import { createContext, type ReactNode, use, useCallback, useEffect, useRef } from 'react';

const ChatEventStreamContext = createContext<ChatEventRegistry | null>(null);

export function ChatEventListeners({ serverId }: { serverId: string }) {
    return (
        <ChatEventStreamProvider serverId={serverId}>
            <ChatEventInvalidations />
        </ChatEventStreamProvider>
    );
}

function ChatEventInvalidations() {
    useMessageCreatedEvents();
    useChatReadEvents();
    useChatLifecycleEvents();
    return null;
}

function ChatEventStreamProvider({
    children,
    serverId,
}: {
    children: ReactNode;
    serverId: string;
}) {
    const queryClient = useQueryClient();
    const utils = grottoTrpc.useUtils();
    const registryRef = useRef<ChatEventRegistry | null>(null);
    registryRef.current ??= createChatEventRegistry();
    const registry = registryRef.current;
    const cursorRef = useRef('0');
    const batchRef = useRef(createChatEventBatch());
    const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dispatchEvents = useCallback(
        async (events: HostedDurableEvent[]) => await registry.dispatch(events, serverId),
        [registry, serverId]
    );
    const flushEventBatch = useCallback(() => {
        if (batchTimerRef.current !== null) {
            clearTimeout(batchTimerRef.current);
            batchTimerRef.current = null;
        }
        const events = batchRef.current.drain();
        if (events) {
            void dispatchEvents(events);
        }
    }, [dispatchEvents]);
    const catchUp = useCallback(async () => {
        if (cursorRef.current === '0') {
            const head = await utils.chat.eventHead.fetch({ serverId });
            cursorRef.current = laterEventCursor(cursorRef.current, head.cursor);
            await queryClient.invalidateQueries({ refetchType: 'active' });
            return;
        }

        const walkedCursor = await walkEventCatchUp({
            afterCursor: cursorRef.current,
            fetchPage: async (afterCursor, limit) =>
                await utils.chat.events.fetch({ afterCursor, limit, serverId }),
            onEvents: dispatchEvents,
        });
        cursorRef.current = laterEventCursor(cursorRef.current, walkedCursor);
    }, [dispatchEvents, queryClient, serverId, utils]);

    useEffect(() => flushEventBatch, [flushEventBatch]);

    grottoTrpc.chat.onEvent.useSubscription(
        { serverId },
        {
            onData: (event) => {
                cursorRef.current = laterEventCursor(cursorRef.current, event.cursor);
                if (batchRef.current.add(event)) {
                    batchTimerRef.current = setTimeout(flushEventBatch, chatEventBatchWindowMs);
                }
            },
            onStarted: () => void catchUp(),
        }
    );

    return <ChatEventStreamContext value={registry}>{children}</ChatEventStreamContext>;
}

function useChatEvent<Type extends ChatEventType>(
    types: Type | readonly Type[],
    handler: ChatEventHandler<Type>
) {
    const registry = use(ChatEventStreamContext);
    if (!registry) {
        throw new Error('useChatEvent must be used within ChatEventStreamProvider.');
    }
    const handlerRef = useRef(handler);
    handlerRef.current = handler;
    const typeKey = typeof types === 'string' ? types : [...types].join(' ');

    useEffect(
        () =>
            registry.register(typeKey.split(' ') as Type[], (events, eventServerId) =>
                handlerRef.current(events, eventServerId)
            ),
        [registry, typeKey]
    );
}

function useMessageCreatedEvents() {
    const queryClient = useQueryClient();
    const utils = grottoTrpc.useUtils();

    useChatEvent('message.created', async (events, serverId) => {
        const chatIds = new Set(
            events.flatMap((event) =>
                event.parentChatId ? [event.chatId, event.parentChatId] : [event.chatId]
            )
        );
        await Promise.all([
            utils.chat.list.invalidate({ serverId }),
            ...[...chatIds].map((chatId) =>
                queryClient.invalidateQueries({
                    queryKey: chatMessagePagesQueryKey(serverId, chatId),
                })
            ),
        ]);
    });
}

function useChatReadEvents() {
    const utils = grottoTrpc.useUtils();
    useChatEvent('chat.read', async (_events, serverId) => {
        await utils.chat.list.invalidate({ serverId });
    });
}

function useChatLifecycleEvents() {
    const utils = grottoTrpc.useUtils();
    useChatEvent('chat.lifecycle', async (_events, serverId) => {
        await utils.chat.list.invalidate({ serverId });
    });
}
