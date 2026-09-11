import { expect, test } from 'bun:test';
import type { Agent, OpenAsk } from '@grotto/api';
import { humanDirectory } from '../human-identity.ts';
import { askAnswerMessage, toNeedsYouAsks } from './needs-you-asks.ts';

const humans = humanDirectory(
    [{ displayName: 'Zach', handle: 'zach', userId: 'user_me' } as never],
    'user_me'
);

function openAsk(overrides: Partial<OpenAsk> = {}): OpenAsk {
    return {
        ask: {
            addresseeUserId: 'user_me',
            agentId: 'agent_blippy',
            answerMessageId: null,
            answeredAt: null,
            answeredBy: null,
            chatId: 'chat_product',
            createdAt: '2026-09-02T12:00:00.000Z',
            id: 'ask_one',
            messageId: 'message_one',
            recommendedStep: 'Ship it',
            status: 'open',
            summary: 'The migration is staged and reversible.',
            title: 'Run the migration?',
        },
        chatKind: 'channel',
        chatName: 'product',
        chatPeerUserId: null,
        conversationChatId: 'chat_product',
        message: {
            author: {
                agentId: 'agent_blippy',
                kind: 'agent',
                profile: {
                    avatarUrl: null,
                    deleted: false,
                    description: null,
                    displayName: 'Blippy (stored)',
                },
            },
            id: 'message_one',
        } as OpenAsk['message'],
        threadAnchorMessage: null,
        threadChatId: 'chat_thread',
        ...overrides,
    };
}

const agents = [{ displayName: 'Blippy', id: 'agent_blippy' } as Agent];

test('a channel Ask reads its title, summary, Chat, and live Agent name', () => {
    // The row states the Ask and opens it; the answer's routing is read off
    // the Server record in the peek, so none of it is projected here.
    expect(toNeedsYouAsks([openAsk()], humans, agents)).toEqual([
        {
            agentId: 'agent_blippy',
            agentName: 'Blippy',
            chatLabel: '#product',
            id: 'message_one',
            summary: 'The migration is staged and reversible.',
            title: 'Run the migration?',
        },
    ]);
});

test('a DM Ask names the peer the way every other context label does', () => {
    const rows = toNeedsYouAsks(
        [openAsk({ chatKind: 'dm', chatName: null, chatPeerUserId: 'user_peer' })],
        humans,
        agents
    );

    expect(rows[0]?.chatLabel).toBe('DM · Human r_peer');
});

test('a DM with the asking Agent reads as a DM without inventing a peer', () => {
    const rows = toNeedsYouAsks(
        [openAsk({ chatKind: 'dm', chatName: null, chatPeerUserId: null })],
        humans,
        agents
    );

    expect(rows[0]?.chatLabel).toBe('DM');
});

test('an Ask summary written as Markdown reads as one flat line', () => {
    const rows = toNeedsYouAsks(
        [
            openAsk({
                ask: {
                    ...openAsk().ask,
                    summary: '## Summary\nThe migration is **staged** and reversible.',
                },
            }),
        ],
        humans,
        agents
    );

    expect(rows[0]?.summary).toBe('Summary The migration is staged and reversible.');
});

test('a retired Agent keeps the name its Message stored', () => {
    expect(toNeedsYouAsks([openAsk()], humans, [])[0]?.agentName).toBe('Blippy (stored)');
});

test('the recommended step answers in the conversation, on the Thread anchor', () => {
    const topLevel = openAsk();
    const inThread = openAsk({
        ask: { ...openAsk().ask, chatId: 'chat_thread' },
        threadAnchorMessage: { id: 'message_anchor' } as OpenAsk['message'],
    });

    // A top-level Ask anchors its own Thread, so the answer replies to the Ask
    // Message itself.
    expect(askAnswerMessage(topLevel, { nonce: 'nonce_one', serverId: 'server_one' })).toEqual({
        attachmentIds: [],
        chatId: 'chat_product',
        content: 'Ship it',
        nonce: 'nonce_one',
        serverId: 'server_one',
        thread: { anchorMessageId: 'message_one' },
    });
    // Threads do not nest: an Ask inside one answers on that Thread's anchor,
    // addressed to the Channel or DM the Thread hangs under.
    expect(
        askAnswerMessage(inThread, { nonce: 'nonce_two', serverId: 'server_one' })
    ).toMatchObject({
        chatId: 'chat_product',
        thread: { anchorMessageId: 'message_anchor' },
    });
});
