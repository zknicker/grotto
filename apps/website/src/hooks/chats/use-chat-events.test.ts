import { expect, test } from 'bun:test';
import { createChatEventHandlers } from './use-chat-events.ts';

test('chat updates refresh agent-scoped chat lists', async () => {
    const invalidatedQueries: string[] = [];
    const handlers = createChatEventHandlers({
        agent: {
            chats: {
                list: {
                    invalidate: async () => invalidatedQueries.push('agent.chats.list'),
                },
            },
            workspaceReadableFile: {
                invalidate: async () => invalidatedQueries.push('agent.workspaceReadableFile'),
            },
        },
        chat: {
            get: {
                invalidate: async () => invalidatedQueries.push('chat.get'),
            },
            list: {
                invalidate: async () => invalidatedQueries.push('chat.list'),
            },
            listArchived: {
                invalidate: async () => invalidatedQueries.push('chat.listArchived'),
            },
        },
    } as never);

    handlers.onChatUpdate({ chatId: 'chat-1' });
    await Promise.resolve();

    expect(invalidatedQueries).toEqual([
        'agent.chats.list',
        'chat.list',
        'chat.listArchived',
        'chat.get',
    ]);
});

test('chat log updates refresh Agent-authored workspace files', async () => {
    const invalidatedQueries: string[] = [];
    const handlers = createChatEventHandlers({
        agent: {
            workspaceReadableFile: {
                invalidate: async () => invalidatedQueries.push('agent.workspaceReadableFile'),
            },
        },
        chat: {
            files: {
                list: {
                    invalidate: async () => invalidatedQueries.push('chat.files.list'),
                },
            },
            log: {
                list: {
                    invalidate: async () => invalidatedQueries.push('chat.log.list'),
                },
            },
        },
    } as never);

    handlers.onChatLogUpdate({ chatId: 'chat-1' });
    await Promise.resolve();

    expect(invalidatedQueries).toEqual([
        'agent.workspaceReadableFile',
        'chat.log.list',
        'chat.files.list',
    ]);
});
