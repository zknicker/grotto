import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import type { OpenAsk } from '@grotto/api';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * The row's only external operation is the send. Bun keeps module mocks
 * registered for the rest of the worker, so copy the real module first, stub
 * on top of it, and put the real exports back once this file is done.
 */
const actualSendHook = { ...(await import('../../../hooks/servers/use-chat-message-send.ts')) };

let send = sendState();

mock.module('../../../hooks/servers/use-chat-message-send.ts', () => ({
    ...actualSendHook,
    useChatMessageSend: () => send,
}));

const { NeedsYouAskOptions } = await import('./needs-you-ask-options.tsx');

afterAll(() => {
    mock.module('../../../hooks/servers/use-chat-message-send.ts', () => actualSendHook);
});

beforeEach(() => {
    send = sendState();
});

test('the options read in the Agent’s order, the recommendation emphasized', () => {
    const markup = renderToStaticMarkup(
        <NeedsYouAskOptions ask={openAsk(['Ship it', 'Hold for review'])} serverId="server_one" />
    );

    expect(markup).toContain('Ship it');
    expect(markup).toContain('Hold for review');
    expect(markup.indexOf('Ship it')).toBeLessThan(markup.indexOf('Hold for review'));
    // The first option is the Agent's recommendation, so it is the only one
    // carrying the emphasized Button variant.
    expect(markup.match(/button--primary/g)).toHaveLength(1);
    expect(markup.match(/button--secondary/g)).toHaveLength(1);
});

test('an open question offers nothing, leaving the composer as the whole answer', () => {
    expect(
        renderToStaticMarkup(<NeedsYouAskOptions ask={openAsk([])} serverId="server_one" />)
    ).toBe('');
});

test('one press spends the whole row', () => {
    send = { ...sendState(), isSuccess: true };

    const markup = renderToStaticMarkup(
        <NeedsYouAskOptions ask={openAsk(['Ship it', 'Hold for review'])} serverId="server_one" />
    );

    expect(markup.match(/disabled=""/g)).toHaveLength(2);
});

test('a failed send says so and leaves the options pressable', () => {
    send = { ...sendState(), error: new Error('Computer is offline') };

    const markup = renderToStaticMarkup(
        <NeedsYouAskOptions ask={openAsk(['Ship it'])} serverId="server_one" />
    );

    expect(markup).toContain('Computer is offline');
    expect(markup).not.toContain('disabled=""');
});

function sendState() {
    return {
        error: null as Error | null,
        isPending: false,
        isSuccess: false,
        mutate: () => undefined,
    };
}

function openAsk(options: string[]): OpenAsk {
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
            options,
            status: 'open',
            summary: 'The migration is staged and reversible.',
            title: 'Run the migration?',
        },
        chatKind: 'channel',
        chatName: 'product',
        chatPeerUserId: null,
        conversationChatId: 'chat_product',
        message: { id: 'message_one' } as OpenAsk['message'],
        threadAnchorMessage: null,
        threadChatId: 'chat_thread',
    };
}
