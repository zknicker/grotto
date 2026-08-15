import assert from 'node:assert/strict';
import test from 'node:test';
import type { ThreadSummary } from '@tavern/api';
import { resolveThreadChatId } from './thread-screen-model.ts';

const discoveredThread = {
    anchorMessageId: 'message-1',
    followed: true,
    latestReplyAt: null,
    recentReplies: [],
    replyCount: 1,
    threadChatId: 'thread-discovered',
    unreadCount: 1,
} satisfies ThreadSummary;

test('resolves an existing Thread from its route', () => {
    assert.equal(
        resolveThreadChatId({
            anchorMessageId: 'message-1',
            createdThreadChatId: undefined,
            routeThreadChatId: 'thread-route',
            threads: [discoveredThread],
        }),
        'thread-route'
    );
});

test('keeps the locally created Thread while the parent summary catches up', () => {
    assert.equal(
        resolveThreadChatId({
            anchorMessageId: 'message-1',
            createdThreadChatId: 'thread-created',
            routeThreadChatId: undefined,
            threads: [],
        }),
        'thread-created'
    );
});

test('adopts a Thread created elsewhere from the refreshed parent summary', () => {
    assert.equal(
        resolveThreadChatId({
            anchorMessageId: 'message-1',
            createdThreadChatId: undefined,
            routeThreadChatId: undefined,
            threads: [discoveredThread],
        }),
        'thread-discovered'
    );
});
