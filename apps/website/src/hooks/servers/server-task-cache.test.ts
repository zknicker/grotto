import { expect, test } from 'bun:test';
import type { HostedMessageTask, HostedTaskListItem } from '@tavern/api';
import { replaceHostedTask } from './server-task-cache.ts';

test('replaces both task projections with the authoritative mutation result', () => {
    const item = taskItem();
    const task = { ...item.task, status: 'in_progress' as const, version: 2 };

    expect(replaceHostedTask([item], task)).toEqual([
        {
            ...item,
            message: { ...item.message, task },
            task,
        },
    ]);
});

function taskItem(): HostedTaskListItem {
    const task: HostedMessageTask = {
        assigneeAgentId: null,
        assigneeUserId: null,
        chatId: 'chat_one',
        claimedAt: null,
        createdAt: '2026-07-26T12:00:00.000Z',
        createdByAgentId: null,
        createdByUserId: 'user_one',
        labels: [],
        messageId: 'message_one',
        number: 1,
        origin: 'composed',
        priority: 'none',
        status: 'todo',
        threadChatId: 'thread_one',
        updatedAt: '2026-07-26T12:00:00.000Z',
        version: 1,
    };
    return {
        chatKind: 'channel',
        chatName: 'all',
        chatPeerUserId: null,
        message: {
            attachments: [],
            author: { kind: 'human', userId: 'user_one' },
            chatId: 'chat_one',
            content: 'Task',
            createdAt: '2026-07-26T12:00:00.000Z',
            id: 'message_one',
            nonce: 'nonce_one',
            sequence: 1,
            serverId: 'server_one',
            task,
        },
        task,
        threadSummary: {
            anchorMessageId: 'message_one',
            followed: false,
            latestReplyAt: null,
            replyCount: 0,
            threadChatId: 'thread_one',
            unreadCount: 0,
        },
    };
}
