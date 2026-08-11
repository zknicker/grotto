import type { HostedDurableEvent } from '@tavern/api';

const pageSize = 100;

export interface ChatEventTargets {
    invalidateAgentChats: boolean;
    invalidateChatList: boolean;
    invalidateSearch: boolean;
    invalidateTaskLabels: boolean;
    invalidateTasks: boolean;
    lifecycleChatIds: string[];
    messageChatIds: string[];
    threadMessageChatIds: string[];
}

/**
 * Maps durable events to the exact queries each event changes. `chat.list` renders chat
 * ordering, unread counts, and Thread attention, so only events that move one of those
 * target it.
 */
export function eventRefetchTargets(events: HostedDurableEvent[]): ChatEventTargets {
    const lifecycleChatIds = new Set<string>();
    const messageChatIds = new Set<string>();
    const threadMessageChatIds = new Set<string>();
    let invalidateAgentChats = false;
    let invalidateChatList = false;
    let invalidateSearch = false;
    let invalidateTaskLabels = false;
    let invalidateTasks = false;

    for (const event of events) {
        switch (event.type) {
            case 'message.created': {
                invalidateChatList = true;
                invalidateSearch = true;
                messageChatIds.add(event.chatId);
                threadMessageChatIds.add(event.chatId);
                if (event.parentChatId) {
                    messageChatIds.add(event.parentChatId);
                }
                break;
            }
            case 'chat.read': {
                invalidateChatList = true;
                break;
            }
            case 'chat.lifecycle': {
                // Agent chat rows are the viewer's visible Chats filtered by Agent
                // membership, so creating, renaming, or retiring a Chat moves them.
                invalidateAgentChats = true;
                invalidateChatList = true;
                lifecycleChatIds.add(event.chatId);
                break;
            }
            case 'thread.follow.updated': {
                // Parent unread counts include Thread attention, which follow state drives.
                invalidateChatList = true;
                messageChatIds.add(event.parentChatId);
                break;
            }
            case 'task.created':
            case 'task.updated': {
                invalidateTasks = true;
                messageChatIds.add(event.chatId);
                threadMessageChatIds.add(event.chatId);
                break;
            }
            case 'task.label.updated': {
                // Task rows embed their label records, so the catalog edit changes both reads.
                invalidateTaskLabels = true;
                invalidateTasks = true;
                break;
            }
            // reminder.changed is deliberately ignored: the operator-scoped reminder
            // lane (reminder.onEvent + reminder.changes) is that namespace's single
            // invalidation owner, and this participant-gated lane cannot see every
            // reminder the Reminders page renders.
            default: {
                break;
            }
        }
    }

    return {
        invalidateAgentChats,
        invalidateChatList,
        invalidateSearch,
        invalidateTaskLabels,
        invalidateTasks,
        lifecycleChatIds: [...lifecycleChatIds],
        messageChatIds: [...messageChatIds],
        threadMessageChatIds: [...threadMessageChatIds],
    };
}

export function emptyChatEventTargets(): ChatEventTargets {
    return eventRefetchTargets([]);
}

export function mergeChatEventTargets(
    left: ChatEventTargets,
    right: ChatEventTargets
): ChatEventTargets {
    return {
        invalidateAgentChats: left.invalidateAgentChats || right.invalidateAgentChats,
        invalidateChatList: left.invalidateChatList || right.invalidateChatList,
        invalidateSearch: left.invalidateSearch || right.invalidateSearch,
        invalidateTaskLabels: left.invalidateTaskLabels || right.invalidateTaskLabels,
        invalidateTasks: left.invalidateTasks || right.invalidateTasks,
        lifecycleChatIds: [...new Set([...left.lifecycleChatIds, ...right.lifecycleChatIds])],
        messageChatIds: [...new Set([...left.messageChatIds, ...right.messageChatIds])],
        threadMessageChatIds: [
            ...new Set([...left.threadMessageChatIds, ...right.threadMessageChatIds]),
        ],
    };
}

/**
 * How long one live-event burst is collected before it invalidates. A busy Chat
 * delivers a message, its read, and its Thread follow within a few frames; one
 * merged pass per window keeps that from costing three refetch fan-outs.
 */
export const chatEventBatchWindowMs = 150;

export interface ChatEventBatch {
    /** Collects one event. Returns true when it opened a new window. */
    add: (event: HostedDurableEvent) => boolean;
    /** Empties the window into one merged target set, or null when nothing waits. */
    drain: () => ChatEventTargets | null;
}

/**
 * The window's collected events, kept outside React so the timer and the
 * subscription share one buffer without re-rendering. Cursor advancement stays
 * with the caller: it is immediate and exact regardless of batching.
 */
export function createChatEventBatch(): ChatEventBatch {
    let pending: HostedDurableEvent[] = [];

    return {
        add: (event) => {
            const opensWindow = pending.length === 0;
            pending.push(event);
            return opensWindow;
        },
        drain: () => {
            if (pending.length === 0) {
                return null;
            }
            const events = pending;
            pending = [];
            return eventRefetchTargets(events);
        },
    };
}

export function laterEventCursor(left: string, right: string): string {
    return BigInt(left) >= BigInt(right) ? left : right;
}

/**
 * Walks every durable event newer than `afterCursor` and reports one coalesced invalidation
 * set after the walk, so a long reconnect gap costs a single refetch pass.
 */
export async function walkEventCatchUp({
    afterCursor,
    fetchPage,
    onTargets,
}: {
    afterCursor: string;
    fetchPage: (afterCursor: string, limit: number) => Promise<HostedDurableEvent[]>;
    onTargets: (targets: ChatEventTargets) => Promise<void>;
}): Promise<string> {
    let walkCursor = afterCursor;
    let targets = emptyChatEventTargets();
    let walkedEvents = 0;
    let events: HostedDurableEvent[];

    do {
        events = await fetchPage(walkCursor, pageSize);
        walkedEvents += events.length;
        targets = mergeChatEventTargets(targets, eventRefetchTargets(events));
        walkCursor = events.at(-1)?.cursor ?? walkCursor;
    } while (events.length === pageSize);

    if (walkedEvents > 0) {
        await onTargets(targets);
    }

    return walkCursor;
}
