import assert from 'node:assert/strict';
import test from 'node:test';
import { readChannelMessages } from './channel-messages.mjs';

test('includes ordinary and task replies only from the requested channel', async () => {
    const tracked = [];
    const read = [];
    const messages = {
        channel: [{ content: 'human request', author: 'human' }],
        ordinary: [{ content: 'ordinary answer', author: 'agent' }],
        task: [{ content: 'task answer', author: 'agent' }],
        unrelated: [{ content: 'wrong channel', author: 'agent' }],
    };
    const kit = {
        serverId: 'server',
        async readMessages(chatId) {
            read.push(chatId);
            return [...messages[chatId]];
        },
        async trpc(procedure, input) {
            assert.equal(procedure, 'chat.messages');
            assert.deepEqual(input, { chatId: 'channel', limit: 100, serverId: 'server' });
            return { threads: [{ threadChatId: 'ordinary' }, { threadChatId: 'task' }] };
        },
        async trackChat(chatId) {
            tracked.push(chatId);
        },
    };
    const result = await readChannelMessages(kit, 'channel');
    assert.deepEqual(
        result.map((message) => message.content),
        ['human request', 'ordinary answer', 'task answer']
    );
    assert.deepEqual(read, ['channel', 'ordinary', 'task']);
    assert.deepEqual(tracked, ['ordinary', 'task']);
    assert.equal(result.filter((message) => message.author === 'agent').length, 2);
});
