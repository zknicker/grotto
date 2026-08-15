import { useEffect, useMemo, useSyncExternalStore } from 'react';

export interface PendingMessage {
    content: string;
    createdAt: string;
    messageId: string | null;
    nonce: string;
}

const pendingByChat = new Map<string, readonly PendingMessage[]>();
const listeners = new Set<() => void>();
const noPendingMessages: readonly PendingMessage[] = [];

export function threadPendingKey(anchorMessageId: string) {
    return `thread:${anchorMessageId}`;
}

export function usePendingMessages(
    chatId: string,
    delivered: readonly { id: string; nonce: string }[] | undefined
) {
    const pending = useSyncExternalStore(
        subscribe,
        () => readPendingMessages(chatId),
        () => noPendingMessages
    );
    const deliveredIds = useMemo(
        () => new Set(delivered?.flatMap((message) => [message.id, message.nonce]) ?? []),
        [delivered]
    );

    useEffect(() => {
        dropDeliveredMessages(chatId, deliveredIds);
    }, [chatId, deliveredIds]);

    return useMemo(() => visiblePendingMessages(pending, deliveredIds), [deliveredIds, pending]);
}

export function addPendingMessage(chatId: string, message: Omit<PendingMessage, 'messageId'>) {
    writePendingMessages(chatId, [...readPendingMessages(chatId), { ...message, messageId: null }]);
}

export function settlePendingMessage(input: { chatId: string; messageId: string; nonce: string }) {
    writePendingMessages(
        input.chatId,
        readPendingMessages(input.chatId).map((message) =>
            message.nonce === input.nonce ? { ...message, messageId: input.messageId } : message
        )
    );
}

export function dropPendingMessage(chatId: string, nonce: string) {
    writePendingMessages(
        chatId,
        readPendingMessages(chatId).filter((message) => message.nonce !== nonce)
    );
}

export function readPendingMessages(chatId: string) {
    return pendingByChat.get(chatId) ?? noPendingMessages;
}

export function visiblePendingMessages(
    pending: readonly PendingMessage[],
    deliveredIds: ReadonlySet<string>
) {
    return pending.filter(
        (message) =>
            !(
                deliveredIds.has(message.nonce) ||
                (message.messageId && deliveredIds.has(message.messageId))
            )
    );
}

export function resetPendingMessagesForTest() {
    pendingByChat.clear();
    emitChange();
}

function dropDeliveredMessages(chatId: string, deliveredIds: ReadonlySet<string>) {
    const current = readPendingMessages(chatId);
    const next = visiblePendingMessages(current, deliveredIds);
    if (next.length !== current.length) {
        writePendingMessages(chatId, next);
    }
}

function writePendingMessages(chatId: string, messages: readonly PendingMessage[]) {
    if (messages.length === 0) {
        pendingByChat.delete(chatId);
    } else {
        pendingByChat.set(chatId, messages);
    }
    emitChange();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}
