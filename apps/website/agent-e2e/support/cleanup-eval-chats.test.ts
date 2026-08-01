import { expect, test } from 'bun:test';
import { expandEvalCleanupChatIds, type EvalCleanupTask } from './cleanup-eval-chats.ts';

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
        expandEvalCleanupChatIds(['chat_probe'], [
            {
                task: {
                    chatId: 'chat_permanent',
                    threadChatId: 'cht_thr_permanent_task',
                },
            },
        ])
    ).toEqual(['chat_probe']);
});
