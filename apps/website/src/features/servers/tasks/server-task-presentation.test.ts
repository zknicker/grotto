import { expect, test } from 'bun:test';
import type { HostedTaskListItem } from '@tavern/api';
import {
    filterServerTasks,
    groupServerTasks,
    serverTaskChatOptions,
    serverTaskClaimAction,
    toServerTask,
} from './server-task-presentation.ts';

test('projects a hosted task from its canonical message', () => {
    const task = toServerTask(item());

    expect(task.id).toBe('message_one');
    expect(task.title).toBe('Ship the hosted board');
    expect(task.threadChatId).toBe('thread_one');
    expect(task.chatLabel).toBe('#all');
    expect(task.claimedAt).toBeNull();
    expect(task.threadSummary.replyCount).toBe(3);
});

test('filters hosted tasks by lifecycle and text without a second content store', () => {
    const todo = toServerTask(item());
    const done = {
        ...todo,
        id: 'message_two',
        number: 2,
        status: 'done' as const,
        title: 'Write docs',
    };

    expect(filterServerTasks([todo, done], { query: 'hosted', view: 'active' })).toEqual([todo]);
    expect(filterServerTasks([todo, done], { query: '#2', view: 'all' })).toEqual([done]);
});

test('groups every lifecycle column in stable order', () => {
    const groups = groupServerTasks([toServerTask(item())]);

    expect(groups.map((group) => group.status)).toEqual([
        'todo',
        'in_progress',
        'in_review',
        'done',
        'closed',
    ]);
    expect(groups[0]?.tasks).toHaveLength(1);
});

test('shows claim controls only when the viewer can perform the action', () => {
    const task = toServerTask(item());

    expect(serverTaskClaimAction(task, 'user_viewer')).toBe('claim');
    expect(
        serverTaskClaimAction(
            { ...task, assigneeUserId: 'user_viewer', claimedAt: null },
            'user_viewer'
        )
    ).toBe('claim-reservation');
    expect(
        serverTaskClaimAction(
            { ...task, assigneeUserId: 'user_viewer', claimedAt: '2026-07-26T12:00:00.000Z' },
            'user_viewer'
        )
    ).toBe('unclaim');
    expect(
        serverTaskClaimAction(
            { ...task, assigneeUserId: 'user_other', claimedAt: '2026-07-26T12:00:00.000Z' },
            'user_viewer'
        )
    ).toBeNull();
    expect(serverTaskClaimAction({ ...task, status: 'done' }, 'user_viewer')).toBeNull();
    expect(
        serverTaskClaimAction({ ...task, assigneeAgentId: 'agent_owner' }, 'user_viewer')
    ).toBeNull();
});

test('treats Agent-owned tasks as assigned in task filters', () => {
    const task = { ...toServerTask(item()), assigneeAgentId: 'agent_owner' };

    expect(filterServerTasks([task], { query: '', view: 'unassigned' })).toEqual([]);
});

test('offers writable Channels and DMs as task creation work surfaces', () => {
    expect(
        serverTaskChatOptions([
            {
                createdAt: '2026-07-26T12:00:00.000Z',
                id: 'chat_channel',
                isAll: true,
                kind: 'channel',
                lastActivityAt: '2026-07-26T12:00:00.000Z',
                lastMessageSequence: 0,
                name: 'all',
                participantUserIds: ['user_viewer'],
                peerAgentDisplayName: null,
                peerAgentId: null,
                peerAgentRetired: false,
                peerUserId: null,
                serverId: 'server_one',
                unreadCount: 0,
            },
            {
                createdAt: '2026-07-26T12:00:00.000Z',
                id: 'chat_dm',
                isAll: false,
                kind: 'dm',
                lastActivityAt: '2026-07-26T12:00:00.000Z',
                lastMessageSequence: 0,
                name: null,
                participantUserIds: ['user_viewer', 'user_peer'],
                peerAgentDisplayName: null,
                peerAgentId: null,
                peerAgentRetired: false,
                peerUserId: 'user_peer',
                serverId: 'server_one',
                unreadCount: 0,
            },
            {
                createdAt: '2026-07-26T12:00:00.000Z',
                id: 'chat_agent_dm',
                isAll: false,
                kind: 'dm',
                lastActivityAt: '2026-07-26T12:00:00.000Z',
                lastMessageSequence: 0,
                name: null,
                participantUserIds: ['user_viewer'],
                peerAgentDisplayName: 'Cove',
                peerAgentId: 'agent_cove',
                peerAgentRetired: false,
                peerUserId: null,
                serverId: 'server_one',
                unreadCount: 0,
            },
            {
                createdAt: '2026-07-26T12:00:00.000Z',
                id: 'chat_retired_agent_dm',
                isAll: false,
                kind: 'dm',
                lastActivityAt: '2026-07-26T12:00:00.000Z',
                lastMessageSequence: 0,
                name: null,
                participantUserIds: ['user_viewer'],
                peerAgentDisplayName: 'Fen',
                peerAgentId: 'agent_fen',
                peerAgentRetired: true,
                peerUserId: null,
                serverId: 'server_one',
                unreadCount: 0,
            },
        ])
    ).toEqual([
        { id: 'chat_channel', label: '#all' },
        { id: 'chat_dm', label: 'Direct · Human r_peer' },
        { id: 'chat_agent_dm', label: 'Direct · Cove' },
    ]);
});

test('identifies a DM task by its peer', () => {
    expect(
        toServerTask({
            ...item(),
            chatKind: 'dm',
            chatName: null,
            chatPeerUserId: 'user_peer',
        }).chatLabel
    ).toBe('Direct · Human r_peer');
});

function item(): HostedTaskListItem {
    return {
        chatKind: 'channel',
        chatName: 'all',
        chatPeerUserId: null,
        message: {
            attachments: [],
            author: { kind: 'human', userId: 'user_one' },
            chatId: 'chat_one',
            content: 'Ship the hosted board',
            createdAt: '2026-07-26T12:00:00.000Z',
            id: 'message_one',
            nonce: 'nonce_one',
            sequence: 1,
            serverId: 'server_one',
        },
        task: {
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
        },
        threadSummary: {
            anchorMessageId: 'message_one',
            followed: false,
            latestReplyAt: '2026-07-26T12:05:00.000Z',
            replyCount: 3,
            threadChatId: 'thread_one',
            unreadCount: 2,
        },
    };
}
