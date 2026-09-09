import * as React from 'react';
import type { TaskOrigin } from './task-presentation.ts';

/**
 * Whether Chat states the tasks Agents claim for themselves.
 *
 * A task is background tracking for an Agent before it is anything a person
 * reads: an Agent claims a message before working on it, and almost every one
 * of those claims is over inside the turn that opened it. Off — the default —
 * Chat reads as a conversation and those claims stay on the Tasks page, where
 * a reader goes to look at them. On, every task states itself under its
 * message the way a human-made one always does.
 *
 * Per device, like the theme: it is how one reader wants Chat to read, not a
 * fact about the Server. It is an external store rather than a provider so
 * that a transcript row, the Preferences row, and the command palette all read
 * the same value without the transcript learning about a context it would only
 * pass through.
 */
const storageKey = 'grotto.chat.showTasks';

let showTasks = readShowTasksInChat();
const listeners = new Set<() => void>();

export function useShowTasksInChat(): boolean {
    return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setShowTasksInChat(next: boolean) {
    showTasks = next;

    if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, next ? 'on' : 'off');
    }

    for (const listener of listeners) {
        listener();
    }
}

/**
 * The stored preference, defaulting off. Nothing stored and anything
 * unrecognized both mean off: the setting only ever turns on by being asked
 * for.
 */
export function readShowTasksInChat(
    storage: Pick<Storage, 'getItem'> | undefined = typeof window === 'undefined'
        ? undefined
        : window.localStorage
): boolean {
    return storage?.getItem(storageKey) === 'on';
}

/**
 * The rule Chat renders a message's task by. A human composed or converted a
 * task on purpose, so Chat always shows it; an Agent's own claim is
 * bookkeeping and appears only when the reader asked to see it.
 */
export function taskVisibleInChat(origin: TaskOrigin, showTasksInChat: boolean): boolean {
    return showTasksInChat || origin !== 'claimed';
}

export const showTasksInChatStorageKey = storageKey;

function getSnapshot() {
    return showTasks;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
