import assert from 'node:assert/strict';
import test from 'node:test';
import type { Chat, ChatMessage } from '@tavern/api';
import { getChatTitle, isVisibleTimelineMessage, toChatSummary } from './mobile-data.ts';

const baseChat = {
    archivedAt: null,
    archivedByUserId: null,
    createdAt: '2026-08-14T12:00:00.000Z',
    isAll: false,
    lastActivityAt: null,
    lastMessageSequence: 0,
    participantAgentIds: [],
    participantUserIds: [],
    peerAgentDisplayName: null,
    peerAgentId: null,
    peerAgentRetired: false,
    peerUserId: null,
    serverId: 'server-1',
    unreadCount: 0,
} satisfies Omit<Chat, 'id' | 'kind' | 'name'>;

test('toChatSummary keeps channels and their unread state', () => {
    const summary = toChatSummary({
        ...baseChat,
        id: 'chat-1',
        kind: 'channel',
        name: 'product',
        unreadCount: 3,
    });

    assert.deepEqual(summary, {
        id: 'chat-1',
        kind: 'channel',
        name: 'product',
        unread: 3,
    });
});

test('toChatSummary exposes Agent DMs and filters human DMs', () => {
    const agentDm = toChatSummary({
        ...baseChat,
        id: 'chat-agent',
        kind: 'dm',
        name: null,
        peerAgentId: 'agent-1',
    });
    const humanDm = toChatSummary({
        ...baseChat,
        id: 'chat-human',
        kind: 'dm',
        name: null,
        peerUserId: 'user-2',
    });

    assert.equal(agentDm?.kind, 'dm');
    assert.equal(humanDm, null);
});

test('getChatTitle resolves an Agent DM through the shared Agent directory', () => {
    assert.equal(
        getChatTitle({ id: 'chat-agent', kind: 'dm', peerAgentId: 'agent-1', unread: 0 }, [
            {
                availability: 'idle',
                avatarUrl: null,
                displayName: 'Blippy',
                id: 'agent-1',
                kind: 'agent',
            },
        ]),
        'Blippy'
    );
});

test('timeline hides retired task receipts without hiding supported system messages', () => {
    const message = {
        attachments: [],
        chatId: 'chat-1',
        content: 'System notice',
        createdAt: '2026-08-14T12:00:00.000Z',
        id: 'message-1',
        nonce: 'notice-1',
        runId: null,
        sequence: 1,
        serverId: 'server-1',
    };

    assert.equal(
        isVisibleTimelineMessage({
            ...message,
            author: { kind: 'system', system: 'reminder' },
        }),
        true
    );
    assert.equal(
        isVisibleTimelineMessage({
            ...message,
            author: { kind: 'system', system: 'session' },
        }),
        true
    );
    assert.equal(
        isVisibleTimelineMessage({
            ...message,
            author: { kind: 'system', system: 'task' },
        } as unknown as ChatMessage),
        false
    );
});
