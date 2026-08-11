import { expect, test } from 'bun:test';
import { emptyChatEventTargets } from './chat-event-cursor.ts';
import { createChatEventInvalidator } from './use-chat-events.ts';

interface Invalidation {
    input?: unknown;
    name: string;
}

const serverId = 'server_one';

test('a lifecycle pass invalidates chat lists, the focused Chat, and Agent chat rows', async () => {
    const { invalidate, recorded } = recordingInvalidator();

    await invalidate({
        ...emptyChatEventTargets(),
        invalidateAgentChats: true,
        invalidateChatList: true,
        lifecycleChatIds: ['chat_one'],
    });

    expect(recorded).toEqual([
        { input: { serverId }, name: 'chat.list' },
        { input: { serverId }, name: 'agent.chats' },
        { input: { serverId }, name: 'chat.listArchived' },
        { input: { chatId: 'chat_one', serverId }, name: 'chat.get' },
    ]);
});

test('a message pass leaves Agent chat rows alone', async () => {
    const { invalidate, recorded } = recordingInvalidator();

    await invalidate({
        ...emptyChatEventTargets(),
        invalidateChatList: true,
        invalidateSearch: true,
        messageChatIds: ['chat_one'],
    });

    expect(recorded.map((entry) => entry.name)).toEqual([
        'chat.list',
        'chat.search',
        'chat.messages',
    ]);
});

test('an empty pass invalidates nothing', async () => {
    const { invalidate, recorded } = recordingInvalidator();

    await invalidate(emptyChatEventTargets());

    expect(recorded).toEqual([]);
});

function recordingInvalidator() {
    const recorded: Invalidation[] = [];
    const record = (name: string) => async (input?: unknown) => {
        recorded.push({ input, name });
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
    } as unknown as Parameters<typeof createChatEventInvalidator>[0]['utils'];
    const queryClient = {
        invalidateQueries: record('threadMessages'),
    } as unknown as Parameters<typeof createChatEventInvalidator>[0]['queryClient'];

    return {
        invalidate: createChatEventInvalidator({ queryClient, serverId, utils }),
        recorded,
    };
}
