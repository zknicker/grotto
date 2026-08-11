import type { HostedDurableEvent } from '@tavern/api';

const pageSize = 100;

export interface ChatEventTargets {
    invalidateChatList: boolean;
    invalidateReminders: boolean;
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
    let invalidateChatList = false;
    let invalidateReminders = false;
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
            case 'reminder.changed': {
                invalidateReminders = true;
                break;
            }
            default: {
                break;
            }
        }
    }

    return {
        invalidateChatList,
        invalidateReminders,
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
        invalidateChatList: left.invalidateChatList || right.invalidateChatList,
        invalidateReminders: left.invalidateReminders || right.invalidateReminders,
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
