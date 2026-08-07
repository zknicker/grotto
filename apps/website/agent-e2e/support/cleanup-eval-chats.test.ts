import { expect, test } from 'bun:test';
import {
    cleanupEvalChats,
    type EvalCleanupTask,
    expandEvalCleanupChatIds,
} from './cleanup-eval-chats.ts';

const task: EvalCleanupTask = {
    task: {
        chatId: 'chat_parent',
        threadChatId: 'cht_thr_task',
    },
};

test('expands a requested task Chat to its deterministic Thread', () => {
    expect(expandEvalCleanupChatIds(['chat_parent', 'chat_parent'], [task])).toEqual([
        'chat_parent',
        'cht_thr_task',
    ]);
});

test('rejects deleting a task Thread without its parent Chat', () => {
    expect(() => expandEvalCleanupChatIds(['cht_thr_task'], [task])).toThrow(
        'parent Chat chat_parent is not in the exact cleanup set'
    );
});

test('does not expand an unrelated task from a permanent Chat', () => {
    expect(
        expandEvalCleanupChatIds(
            ['chat_probe'],
            [
                {
                    task: {
                        chatId: 'chat_permanent',
                        threadChatId: 'cht_thr_permanent_task',
                    },
                },
            ]
        )
    ).toEqual(['chat_probe']);
});

test('deletes ordinary message Threads with their requested parent Chat', async () => {
    const calls: Array<{ input: Record<string, unknown>; path: string }> = [];
    const harness = {
        serverId: 'server_1',
        trpc: async (path: string, input: Record<string, unknown>) => {
            calls.push({ input, path });
            if (path === 'task.list') {
                return [];
            }
            if (path === 'chat.messages') {
                return { threads: [{ threadChatId: 'cht_thr_message' }] };
            }
            return { count: 2 };
        },
    };

    await cleanupEvalChats(harness, ['chat_parent']);

    expect(calls.at(-1)).toEqual({
        input: {
            chatIds: ['chat_parent', 'cht_thr_message'],
            serverId: 'server_1',
        },
        path: 'dev.cleanupEvalChats',
    });
});
