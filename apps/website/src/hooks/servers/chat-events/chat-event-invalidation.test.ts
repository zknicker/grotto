import { expect, test } from 'bun:test';
import type { QueryClient } from '@tanstack/react-query';
import { threadMessagesQueryKey } from '../use-thread-messages.ts';
import {
    lifecycleEvent,
    messageEvent,
    taskEvent,
    threadFollowEvent,
} from './chat-event-fixtures.ts';
import type { ChatEventUtils } from './chat-event-invalidation.ts';
import { invalidateChatLifecycle } from './use-chat-lifecycle-events.ts';
import { invalidateChatRead } from './use-chat-read-events.ts';
import { invalidateMessageCreated } from './use-message-created-events.ts';
import { invalidateTaskChanges } from './use-task-change-events.ts';
import { invalidateTaskLabelChanges } from './use-task-label-events.ts';
import { invalidateThreadFollow } from './use-thread-follow-events.ts';

interface Invalidation {
    input?: unknown;
    name: string;
    options?: unknown;
}

const serverId = 'server_one';

test('a message pass refetches the chat list, search, and both transcript reads', async () => {
    const { queryClient, recorded, utils } = recordingCaches();

    await invalidateMessageCreated({
        events: [messageEvent('2', 'chat_thread', 'chat_parent')],
        queryClient,
        serverId,
        utils,
    });

    expect(recorded).toEqual([
        { input: { serverId }, name: 'chat.list' },
        { input: { serverId }, name: 'chat.search' },
        { input: { chatId: 'chat_thread', serverId }, name: 'chat.messages' },
        { input: { chatId: 'chat_parent', serverId }, name: 'chat.messages' },
        {
            input: { queryKey: threadMessagesQueryKey(serverId, 'chat_thread') },
            name: 'threadMessages',
        },
    ]);
});

test('a message burst refetches each Chat once', async () => {
    const { queryClient, recorded, utils } = recordingCaches();

    await invalidateMessageCreated({
        events: [
            messageEvent('2', 'chat_one'),
            messageEvent('3', 'chat_one'),
            messageEvent('4', 'chat_two'),
        ],
        queryClient,
        serverId,
        utils,
    });

    expect(recorded.filter((entry) => entry.name === 'chat.messages')).toEqual([
        { input: { chatId: 'chat_one', serverId }, name: 'chat.messages' },
        { input: { chatId: 'chat_two', serverId }, name: 'chat.messages' },
    ]);
    expect(recorded.filter((entry) => entry.name === 'threadMessages')).toHaveLength(2);
});

test('a read pass refetches the chat list alone', async () => {
    const { recorded, utils } = recordingCaches();

    await invalidateChatRead({ serverId, utils });

    expect(recorded).toEqual([{ input: { serverId }, name: 'chat.list' }]);
});

test('a lifecycle pass refetches chat lists, the changed Chats, and Agent chat rows', async () => {
    const { recorded, utils } = recordingCaches();

    await invalidateChatLifecycle({
        events: [
            lifecycleEvent('5', 'chat_one', 'created'),
            lifecycleEvent('6', 'chat_one', 'updated'),
            lifecycleEvent('7', 'chat_two', 'archived'),
        ],
        serverId,
        utils,
    });

    expect(recorded).toEqual([
        { input: { serverId }, name: 'chat.list' },
        { input: { serverId }, name: 'agent.chats' },
        { input: { serverId }, name: 'chat.listArchived' },
        { input: { chatId: 'chat_one', serverId }, name: 'chat.get' },
        { input: { chatId: 'chat_two', serverId }, name: 'chat.get' },
    ]);
});

test('a follow pass refetches the chat list and the parent transcript', async () => {
    const { recorded, utils } = recordingCaches();

    await invalidateThreadFollow({
        events: [threadFollowEvent('2', 'thread_one', 'chat_parent')],
        serverId,
        utils,
    });

    expect(recorded).toEqual([
        { input: { serverId }, name: 'chat.list' },
        { input: { chatId: 'chat_parent', serverId }, name: 'chat.messages' },
    ]);
});

test('a task pass refetches the task list and the affected transcripts, not the chat list', async () => {
    const { queryClient, recorded, utils } = recordingCaches();

    await invalidateTaskChanges({
        events: [taskEvent('3', 'chat_one', 'task.created'), taskEvent('4', 'chat_one')],
        queryClient,
        serverId,
        utils,
    });

    expect(recorded).toEqual([
        { input: { serverId }, name: 'task.list', options: { refetchType: 'all' } },
        { input: { chatId: 'chat_one', serverId }, name: 'chat.messages' },
        {
            input: { queryKey: threadMessagesQueryKey(serverId, 'chat_one') },
            name: 'threadMessages',
        },
    ]);
});

test('a task label pass refetches the label catalog and the task list only', async () => {
    const { recorded, utils } = recordingCaches();

    await invalidateTaskLabelChanges({ serverId, utils });

    expect(recorded).toEqual([
        { input: { serverId }, name: 'task.list', options: { refetchType: 'all' } },
        { input: { serverId }, name: 'taskLabel.list', options: { refetchType: 'all' } },
    ]);
});

function recordingCaches() {
    const recorded: Invalidation[] = [];
    const record = (name: string) => async (input?: unknown, options?: unknown) => {
        recorded.push(options === undefined ? { input, name } : { input, name, options });
    };
    const utils = {
        agent: { chats: { invalidate: record('agent.chats') } },
        chat: {
            get: { invalidate: record('chat.get') },
            list: { invalidate: record('chat.list') },
            listArchived: { invalidate: record('chat.listArchived') },
            messages: { invalidate: record('chat.messages') },
            search: { invalidate: record('chat.search') },
        },
        task: { list: { invalidate: record('task.list') } },
        taskLabel: { list: { invalidate: record('taskLabel.list') } },
    } as unknown as ChatEventUtils;
    const queryClient = {
        invalidateQueries: record('threadMessages'),
    } as unknown as QueryClient;

    return { queryClient, recorded, utils };
}
