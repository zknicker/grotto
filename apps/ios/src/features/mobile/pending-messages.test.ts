import { beforeEach, expect, test } from 'bun:test';
import {
    addPendingMessage,
    dropPendingMessage,
    readPendingMessages,
    resetPendingMessagesForTest,
    settlePendingMessage,
    visiblePendingMessages,
} from './pending-messages';

beforeEach(resetPendingMessagesForTest);

test('queues rapid sends independently and retires each by nonce or durable id', () => {
    addPendingMessage('chat-one', {
        content: 'first',
        createdAt: '2026-08-14T17:00:00.000Z',
        nonce: 'nonce-one',
    });
    addPendingMessage('chat-one', {
        content: 'second',
        createdAt: '2026-08-14T17:00:01.000Z',
        nonce: 'nonce-two',
    });
    settlePendingMessage({ chatId: 'chat-one', messageId: 'msg-one', nonce: 'nonce-one' });

    expect(visiblePendingMessages(readPendingMessages('chat-one'), new Set(['msg-one']))).toEqual([
        expect.objectContaining({ content: 'second', nonce: 'nonce-two' }),
    ]);
    expect(visiblePendingMessages(readPendingMessages('chat-one'), new Set(['nonce-two']))).toEqual(
        [expect.objectContaining({ content: 'first', messageId: 'msg-one' })]
    );
});

test('drops only the failed send', () => {
    for (const nonce of ['nonce-one', 'nonce-two']) {
        addPendingMessage('chat-one', {
            content: nonce,
            createdAt: '2026-08-14T17:00:00.000Z',
            nonce,
        });
    }

    dropPendingMessage('chat-one', 'nonce-one');

    expect(readPendingMessages('chat-one').map((message) => message.nonce)).toEqual(['nonce-two']);
});
