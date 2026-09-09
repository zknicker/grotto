import { expect, test } from 'bun:test';
import {
    readShowTasksInChat,
    showTasksInChatStorageKey,
    taskVisibleInChat,
} from './show-tasks-in-chat.ts';

test('showing tasks in chat is off until a reader asks for it', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null };

    expect(readShowTasksInChat(storage)).toBe(false);

    values.set(showTasksInChatStorageKey, 'off');
    expect(readShowTasksInChat(storage)).toBe(false);

    values.set(showTasksInChatStorageKey, 'on');
    expect(readShowTasksInChat(storage)).toBe(true);
});

test('chat hides an Agent claim by default and never hides a task a human made', () => {
    expect(taskVisibleInChat('claimed', false)).toBe(false);
    expect(taskVisibleInChat('claimed', true)).toBe(true);

    for (const showTasks of [false, true]) {
        expect(taskVisibleInChat('composed', showTasks)).toBe(true);
        expect(taskVisibleInChat('converted', showTasks)).toBe(true);
    }
});
