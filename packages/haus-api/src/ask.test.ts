import { expect, test } from 'bun:test';
import {
    agentAskInputSchema,
    agentAskReceiptSchema,
    askSchema,
    messageBodySchema,
    openAskSchema,
    openAskThreadAnchor,
    serverdurableeventSchema,
} from './index.ts';

const openAsk = {
    addresseeUserId: 'usr_ada',
    agentId: 'agt_orbit',
    answerMessageId: null,
    answeredAt: null,
    answeredBy: null,
    chatId: 'cht_product',
    createdAt: '2026-09-03T12:00:00.000Z',
    id: 'ask_1234567890abcdef',
    messageId: 'msg_1234567890abcdef',
    recommendedStep: 'Approve the staged migration.',
    status: 'open',
    summary: 'The staged migration is ready and needs a human decision before it runs.',
    title: 'Run the staged migration?',
};

test('an Ask carries its request and settlement in one narrow record', () => {
    expect(askSchema.parse(openAsk)).toMatchObject({ answeredBy: null, status: 'open' });
    expect(
        askSchema.parse({
            ...openAsk,
            answerMessageId: 'msg_answer',
            answeredAt: '2026-09-03T12:30:00.000Z',
            answeredBy: { id: 'usr_ada', kind: 'user' },
            status: 'answered',
        }).answeredBy
    ).toEqual({ id: 'usr_ada', kind: 'user' });
    expect(
        askSchema.safeParse({ ...openAsk, answeredBy: { id: 'agt_scout', kind: 'agent' } }).success
    ).toBe(true);
    expect(askSchema.safeParse({ ...openAsk, status: 'closed' }).success).toBe(false);
    expect(askSchema.safeParse({ ...openAsk, title: '' }).success).toBe(false);
    expect(askSchema.safeParse({ ...openAsk, title: 'a'.repeat(121) }).success).toBe(false);
    expect(askSchema.safeParse({ ...openAsk, summary: 'a'.repeat(501) }).success).toBe(false);
    expect(askSchema.safeParse({ ...openAsk, recommendedStep: 'a'.repeat(201) }).success).toBe(
        false
    );
});

test('a Message body is exhaustive across text and ask', () => {
    expect(messageBodySchema.parse({ kind: 'text' })).toEqual({ kind: 'text' });
    expect(messageBodySchema.parse({ ask: openAsk, kind: 'ask' })).toMatchObject({
        ask: { id: 'ask_1234567890abcdef' },
        kind: 'ask',
    });
    expect(messageBodySchema.safeParse({ kind: 'cloud-agent-work' }).success).toBe(false);
    expect(messageBodySchema.safeParse({ kind: 'ask' }).success).toBe(false);
});

test('ask.updated joins the durable event union', () => {
    expect(
        serverdurableeventSchema.parse({
            askId: 'ask_1234567890abcdef',
            chatId: 'cht_product',
            createdAt: '2026-09-03T12:00:00.000Z',
            cursor: '12',
            id: 'evt_ask',
            messageId: 'msg_1234567890abcdef',
            parentChatId: null,
            sequence: 7,
            serverId: 'srv_main',
            type: 'ask.updated',
        })
    ).toMatchObject({ askId: 'ask_1234567890abcdef', type: 'ask.updated' });
    expect(
        serverdurableeventSchema.safeParse({
            chatId: 'cht_product',
            createdAt: '2026-09-03T12:00:00.000Z',
            cursor: '12',
            id: 'evt_ask',
            messageId: 'msg_1234567890abcdef',
            parentChatId: null,
            sequence: 7,
            serverId: 'srv_main',
            type: 'ask.updated',
        }).success
    ).toBe(false);
});

test('the open-Ask row and the Agent request keep their narrow shapes', () => {
    const message = {
        attachments: [],
        author: { agentId: 'agt_orbit', kind: 'agent' },
        body: { ask: openAsk, kind: 'ask' },
        chatId: 'cht_product',
        content: 'The migration is staged. Should I run it?',
        createdAt: '2026-09-03T12:00:00.000Z',
        id: 'msg_1234567890abcdef',
        nonce: 'ask-1',
        runId: 'run_1',
        sequence: 7,
        serverId: 'srv_main',
    };
    const topLevel = openAskSchema.parse({
        ask: openAsk,
        chatKind: 'channel',
        chatName: 'product',
        chatPeerUserId: null,
        conversationChatId: 'cht_product',
        message,
        threadAnchorMessage: null,
        threadChatId: 'cht_thr_12345678',
    });

    expect(topLevel.message.body).toMatchObject({ kind: 'ask' });
    // A top-level Ask anchors its own Thread, so it carries no second anchor.
    expect(openAskThreadAnchor(topLevel).id).toBe('msg_1234567890abcdef');

    const anchor = { ...message, body: { kind: 'text' }, id: 'msg_anchor', sequence: 3 };
    const inThread = openAskSchema.parse({
        ask: { ...openAsk, chatId: 'cht_thr_anchor00' },
        chatKind: 'channel',
        chatName: 'product',
        chatPeerUserId: null,
        conversationChatId: 'cht_product',
        message,
        threadAnchorMessage: anchor,
        threadChatId: 'cht_thr_anchor00',
    });

    // An Ask inside a Thread answers on that Thread's own anchor, in the
    // Channel or DM the Thread hangs under — never on the Thread's Chat id.
    expect(openAskThreadAnchor(inThread).id).toBe('msg_anchor');
    expect(inThread.conversationChatId).toBe('cht_product');
    expect(
        openAskSchema.safeParse({
            ask: openAsk,
            chatKind: 'channel',
            chatName: 'product',
            chatPeerUserId: null,
            message,
            threadAnchorMessage: null,
            threadChatId: 'cht_thr_12345678',
        }).success
    ).toBe(false);

    expect(
        agentAskInputSchema.parse({
            addresseeHandle: 'Ada',
            content: 'The migration is staged. Should I run it?',
            nonce: 'ask-1',
            recommendedStep: 'Approve the staged migration.',
            summary: 'The staged migration is ready and needs a human decision before it runs.',
            target: '#product',
            title: 'Run the staged migration?',
        }).addresseeHandle
    ).toBe('ada');
    expect(
        agentAskInputSchema.safeParse({
            addresseeHandle: 'ada',
            content: '   ',
            nonce: 'ask-1',
            recommendedStep: 'Approve the staged migration.',
            summary: 'The staged migration is ready.',
            target: '#product',
            title: 'Run the staged migration?',
        }).success
    ).toBe(false);
    expect(
        agentAskReceiptSchema.parse({
            ask: openAsk,
            chatId: 'cht_product',
            idempotent: false,
            messageId: 'msg_1234567890abcdef',
            sequence: 7,
            target: '#product',
        })
    ).toMatchObject({ idempotent: false });
});
