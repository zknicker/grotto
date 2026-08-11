import type { HostedAttachmentMetadata } from '@tavern/api';
import * as React from 'react';

/**
 * One send the composer has already let go of. The draft leaves the editor the
 * moment the user hits send, so the transcript shows this stand-in until the
 * durable message lands. App-local by design: durable chat history is never
 * patched to carry an unsent row.
 */
export interface PendingChatMessage {
    /** Composer-local metadata; the bytes are still uploading behind this row. */
    attachments: readonly HostedAttachmentMetadata[];
    content: string;
    /** The durable id from the send receipt; null until the send resolves. */
    messageId: string | null;
    /** The send nonce, and this row's stable local identity. */
    nonce: string;
}

const pendingByChat = new Map<string, readonly PendingChatMessage[]>();
const listeners = new Set<() => void>();
const noPendingMessages: readonly PendingChatMessage[] = [];

/**
 * The chat's pending rows, minus any whose durable message the transcript
 * already has. Rapid sends queue: each keeps its own row until its own message
 * lands. The send nonce is the match — it is known before the send resolves,
 * so a durable row that arrives over the event stream ahead of the receipt
 * still replaces its stand-in in the same render rather than doubling it.
 */
export function usePendingChatMessages(
    chatId: string,
    delivered: readonly { id: string; nonce: string }[] | undefined
) {
    const pending = React.useSyncExternalStore(
        subscribe,
        () => readPendingChatMessages(chatId),
        () => noPendingMessages
    );
    const deliveredIds = React.useMemo(
        () => new Set(delivered?.flatMap((message) => [message.id, message.nonce]) ?? []),
        [delivered]
    );

    // The store is external to React, so retiring a landed row is real
    // synchronization rather than derived state.
    React.useEffect(() => {
        if (pending.length === 0) {
            return;
        }

        dropDeliveredPendingChatMessages(chatId, deliveredIds);
    }, [chatId, deliveredIds, pending]);

    return React.useMemo(
        () => visiblePendingChatMessages(pending, deliveredIds),
        [deliveredIds, pending]
    );
}

export function readPendingChatMessages(chatId: string): readonly PendingChatMessage[] {
    return pendingByChat.get(chatId) ?? noPendingMessages;
}

export function addPendingChatMessage(
    chatId: string,
    message: Omit<PendingChatMessage, 'messageId'>
) {
    writePendingChatMessages(chatId, [
        ...readPendingChatMessages(chatId),
        { ...message, messageId: null },
    ]);
}

/** Records the durable id a send returned so the row can retire on arrival. */
export function settlePendingChatMessage(input: {
    chatId: string;
    messageId: string;
    nonce: string;
}) {
    writePendingChatMessages(
        input.chatId,
        readPendingChatMessages(input.chatId).map((message) =>
            message.nonce === input.nonce ? { ...message, messageId: input.messageId } : message
        )
    );
}

/** Drops a row whose send failed; the composer restores its draft instead. */
export function dropPendingChatMessage(chatId: string, nonce: string) {
    writePendingChatMessages(
        chatId,
        readPendingChatMessages(chatId).filter((message) => message.nonce !== nonce)
    );
}

/** `deliveredIds` holds both the ids and the nonces the transcript already has. */
export function visiblePendingChatMessages(
    pending: readonly PendingChatMessage[],
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

export function dropDeliveredPendingChatMessages(
    chatId: string,
    deliveredIds: ReadonlySet<string>
) {
    const current = readPendingChatMessages(chatId);
    const next = visiblePendingChatMessages(current, deliveredIds);

    if (next.length !== current.length) {
        writePendingChatMessages(chatId, next);
    }
}

export function resetPendingChatMessagesForTest() {
    pendingByChat.clear();
    emitChange();
}

function writePendingChatMessages(chatId: string, messages: readonly PendingChatMessage[]) {
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
