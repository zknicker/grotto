import { expect, test } from 'bun:test';
import type { Agent, TaskListItem } from '@grotto/api';
import { humanDirectory } from '../human-identity.ts';
import {
    filterTasks,
    groupTasks,
    taskChatOptions,
    taskClaimAction,
    toTaskItem,
} from './task-model.ts';

const humans = humanDirectory([]);

test('projects a task from its canonical message', () => {
    const task = toTaskItem(item(), humans);

    expect(task.id).toBe('message_one');
    expect(task.title).toBe('Ship the Server board');
    expect(task.threadChatId).toBe('thread_one');
    expect(task.chatLabel).toBe('#all');
    expect(task.claimedAt).toBeNull();
    expect(task.threadSummary.replyCount).toBe(3);
});

test('filters tasks by lifecycle without a second content store', () => {
    const todo = toTaskItem(item(), humans);
    const done = {
        ...todo,
        id: 'message_two',
        number: 2,
        status: 'done' as const,
        title: 'Write docs',
    };

    expect(filterTasks([todo, done], { view: 'active' })).toEqual([todo]);
    expect(filterTasks([todo, done], { view: 'all' })).toEqual([todo, done]);
});

test('filters tasks by label id', () => {
    const labeled = {
        ...toTaskItem(item(), humans),
        labels: [{ color: 'red' as const, id: 'lbl_one', name: 'Bug' }],
    };
    const bare = { ...toTaskItem(item(), humans), id: 'message_two', labels: [], number: 2 };

    expect(filterTasks([labeled, bare], { labelId: 'lbl_one', view: 'all' })).toEqual([labeled]);
    expect(filterTasks([labeled, bare], { labelId: null, view: 'all' })).toEqual([labeled, bare]);
});

test('groups every lifecycle column in stable order', () => {
    const groups = groupTasks([toTaskItem(item(), humans)]);

    expect(groups.map((group) => group.status)).toEqual([
        'todo',
        'in_progress',
        'in_review',
        'done',
        'closed',
    ]);
    expect(groups[0]?.tasks).toHaveLength(1);
});

test('orders each status group by priority, urgent first and unset last', () => {
    const base = toTaskItem(item(), humans);
    const none = { ...base, id: 'message_none', number: 2 };
    const low = { ...base, id: 'message_low', number: 3, priority: 'low' as const };
    const urgent = { ...base, id: 'message_urgent', number: 4, priority: 'urgent' as const };

    const groups = groupTasks([none, low, urgent]);

    expect(groups[0]?.tasks.map((task) => task.id)).toEqual([
        'message_urgent',
        'message_low',
        'message_none',
    ]);
});

test('projects the assignee avatar from the agent directory', () => {
    const assigned = {
        ...item(),
        task: { ...item().task, assigneeAgentId: 'agent_owner' },
    };

    const task = toTaskItem(assigned, humans, [agent()]);

    expect(task.assigneeLabel).toBe('Fen');
    expect(task.assigneeAvatarUrl).toBe('/api/avatars/avt_fen');
    expect(toTaskItem(item(), humans).assigneeAvatarUrl).toBeNull();
});

test('shows claim controls only when the viewer can perform the action', () => {
    const task = toTaskItem(item(), humans);

    expect(taskClaimAction(task, 'user_viewer')).toBe('claim');
    expect(
        taskClaimAction({ ...task, assigneeUserId: 'user_viewer', claimedAt: null }, 'user_viewer')
    ).toBe('claim-reservation');
    expect(
        taskClaimAction(
            { ...task, assigneeUserId: 'user_viewer', claimedAt: '2026-07-26T12:00:00.000Z' },
            'user_viewer'
        )
    ).toBe('unclaim');
    expect(
        taskClaimAction(
            { ...task, assigneeUserId: 'user_other', claimedAt: '2026-07-26T12:00:00.000Z' },
            'user_viewer'
        )
    ).toBeNull();
    expect(taskClaimAction({ ...task, status: 'done' }, 'user_viewer')).toBeNull();
    expect(taskClaimAction({ ...task, assigneeAgentId: 'agent_owner' }, 'user_viewer')).toBeNull();
});

test('treats Agent-owned tasks as assigned in task filters', () => {
    const task = { ...toTaskItem(item(), humans), assigneeAgentId: 'agent_owner' };

    expect(filterTasks([task], { view: 'unassigned' })).toEqual([]);
});

test('offers writable Channels and DMs as task creation work surfaces', () => {
    expect(
        taskChatOptions(
            [
                {
                    archivedAt: null,
                    archivedByUserId: null,
                    color: null,
                    createdAt: '2026-07-26T12:00:00.000Z',
                    icon: null,
                    id: 'chat_channel',
                    isAll: true,
                    kind: 'channel',
                    lastActivityAt: '2026-07-26T12:00:00.000Z',
                    lastMessageSequence: 0,
                    name: 'all',
                    participantAgentIds: [],
                    participantUserIds: ['user_viewer'],
                    peerAgentDisplayName: null,
                    peerAgentId: null,
                    peerAgentRetired: false,
                    peerUserId: null,
                    serverId: 'server_one',
                    unreadCount: 0,
                },
                {
                    archivedAt: null,
                    archivedByUserId: null,
                    color: null,
                    createdAt: '2026-07-26T12:00:00.000Z',
                    icon: null,
                    id: 'chat_dm',
                    isAll: false,
                    kind: 'dm',
                    lastActivityAt: '2026-07-26T12:00:00.000Z',
                    lastMessageSequence: 0,
                    name: null,
                    participantAgentIds: [],
                    participantUserIds: ['user_viewer', 'user_peer'],
                    peerAgentDisplayName: null,
                    peerAgentId: null,
                    peerAgentRetired: false,
                    peerUserId: 'user_peer',
                    serverId: 'server_one',
                    unreadCount: 0,
                },
                {
                    archivedAt: null,
                    archivedByUserId: null,
                    color: null,
                    createdAt: '2026-07-26T12:00:00.000Z',
                    icon: null,
                    id: 'chat_agent_dm',
                    isAll: false,
                    kind: 'dm',
                    lastActivityAt: '2026-07-26T12:00:00.000Z',
                    lastMessageSequence: 0,
                    name: null,
                    participantAgentIds: [],
                    participantUserIds: ['user_viewer'],
                    peerAgentDisplayName: 'Cove',
                    peerAgentId: 'agent_cove',
                    peerAgentRetired: false,
                    peerUserId: null,
                    serverId: 'server_one',
                    unreadCount: 0,
                },
                {
                    archivedAt: null,
                    archivedByUserId: null,
                    color: null,
                    createdAt: '2026-07-26T12:00:00.000Z',
                    icon: null,
                    id: 'chat_retired_agent_dm',
                    isAll: false,
                    kind: 'dm',
                    lastActivityAt: '2026-07-26T12:00:00.000Z',
                    lastMessageSequence: 0,
                    name: null,
                    participantAgentIds: [],
                    participantUserIds: ['user_viewer'],
                    peerAgentDisplayName: 'Fen',
                    peerAgentId: 'agent_fen',
                    peerAgentRetired: true,
                    peerUserId: null,
                    serverId: 'server_one',
                    unreadCount: 0,
                },
            ],
            humans
        )
    ).toEqual([
        { id: 'chat_channel', label: '#all' },
        { id: 'chat_dm', label: 'DM · Human r_peer' },
        { id: 'chat_agent_dm', label: 'DM · Cove' },
    ]);
});

test('identifies a DM task by its peer', () => {
    expect(
        toTaskItem(
            {
                ...item(),
                chatKind: 'dm',
                chatName: null,
                chatPeerUserId: 'user_peer',
            },
            humans
        ).chatLabel
    ).toBe('DM · Human r_peer');
});

function agent(): Agent {
    return {
        availability: 'idle',
        avatarUrl: '/api/avatars/avt_fen',
        computerId: 'cmp_one',
        createdAt: '2026-07-26T12:00:00.000Z',
        createdByUserId: 'user_one',
        description: null,
        desiredModelId: 'model_one',
        desiredRuntimeId: 'runtime_one',
        displayName: 'Fen',
        dmChatId: null,
        effectiveModelId: null,
        effectiveReportedAt: null,
        effectiveRuntimeId: null,
        factoryKind: 'ordinary',
        handle: 'fen',
        id: 'agent_owner',
        missingResources: [],
        role: 'member',
        serverId: 'server_one',
        status: 'pending',
    };
}

function item(): TaskListItem {
    return {
        chatKind: 'channel',
        chatName: 'all',
        chatPeerUserId: null,
        message: {
            attachments: [],
            author: { kind: 'human', userId: 'user_one' },
            chatId: 'chat_one',
            content: 'Ship the Server board',
            createdAt: '2026-07-26T12:00:00.000Z',
            id: 'message_one',
            nonce: 'nonce_one',
            runId: null,
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
            recentReplies: [],
            replyCount: 3,
            threadChatId: 'thread_one',
            unreadCount: 2,
        },
    };
}
