import { expect, test } from 'bun:test';
import {
    hostedChatMarkReadInputSchema,
    hostedChatMessageSchema,
    hostedChatSendInputSchema,
    hostedDurableEventSchema,
} from './hosted-chat.ts';

test('hosted sends accept only client intent and never an authoritative actor', () => {
    expect(
        hostedChatSendInputSchema.parse({
            chatId: 'cht_all',
            content: 'Hello from the hosted Server.',
            nonce: 'send-1',
            serverId: 'srv_main',
        })
    ).toEqual({
        attachmentIds: [],
        chatId: 'cht_all',
        content: 'Hello from the hosted Server.',
        nonce: 'send-1',
        serverId: 'srv_main',
    });

    expect(() =>
        hostedChatSendInputSchema.parse({
            authorUserId: 'usr_intruder',
            chatId: 'cht_all',
            content: 'No.',
            nonce: 'send-2',
            serverId: 'srv_main',
        })
    ).toThrow();
});

test('hosted reads derive the reader from the verified Clerk member', () => {
    expect(
        hostedChatMarkReadInputSchema.parse({
            chatId: 'cht_all',
            sequence: 4,
            serverId: 'srv_main',
        })
    ).toEqual({ chatId: 'cht_all', sequence: 4, serverId: 'srv_main' });
    expect(() =>
        hostedChatMarkReadInputSchema.parse({
            chatId: 'cht_all',
            readerUserId: 'usr_intruder',
            sequence: 4,
            serverId: 'srv_main',
        })
    ).toThrow();
});

test('hosted messages and durable events keep stable Server and Chat identity', () => {
    const message = hostedChatMessageSchema.parse({
        attachments: [],
        author: { kind: 'human', userId: 'usr_human' },
        chatId: 'cht_all',
        content: 'Durable.',
        createdAt: '2026-07-26T12:00:00.000Z',
        id: 'msg_one',
        nonce: 'send-1',
        runId: null,
        sequence: 1,
        serverId: 'srv_main',
    });

    expect(
        hostedDurableEventSchema.parse({
            chatId: message.chatId,
            createdAt: message.createdAt,
            cursor: '4',
            id: 'evt_one',
            messageId: message.id,
            parentChatId: null,
            sequence: message.sequence,
            serverId: message.serverId,
            type: 'message.created',
        })
    ).toMatchObject({ cursor: '4', messageId: 'msg_one', type: 'message.created' });
    expect(
        hostedDurableEventSchema.parse({
            action: 'fired',
            chatId: message.chatId,
            createdAt: message.createdAt,
            cursor: '5',
            id: 'evt_reminder',
            parentChatId: null,
            reminderId: 'rem_one',
            sequence: message.sequence,
            serverId: message.serverId,
            type: 'reminder.changed',
        })
    ).toMatchObject({ action: 'fired', reminderId: 'rem_one' });
    expect(
        hostedDurableEventSchema.parse({
            action: 'archived',
            chatId: message.chatId,
            createdAt: message.createdAt,
            cursor: '6',
            id: 'evt_archive',
            parentChatId: null,
            sequence: 0,
            serverId: message.serverId,
            type: 'chat.lifecycle',
        })
    ).toMatchObject({ action: 'archived', chatId: 'cht_all', type: 'chat.lifecycle' });
});

test('hosted message history can preserve a deleted author profile', () => {
    const message = hostedChatMessageSchema.parse({
        attachments: [],
        author: {
            agentId: 'agt_cove',
            kind: 'agent',
            profile: {
                avatarUrl: '/api/avatars/avt_cove',
                deleted: true,
                description: 'Onboarding Assistant',
                displayName: 'Cove',
            },
        },
        chatId: 'cht_onboarding',
        content: 'Historical guidance.',
        createdAt: '2026-08-10T12:00:00.000Z',
        id: 'msg_cove',
        nonce: 'cove-history',
        runId: null,
        sequence: 1,
        serverId: 'srv_main',
    });

    expect(message.author).toMatchObject({
        kind: 'agent',
        profile: { deleted: true, displayName: 'Cove' },
    });
});

test('hosted message contracts carry Server-authored task timeline receipts', () => {
    expect(
        hostedChatMessageSchema.parse({
            attachments: [],
            author: { kind: 'system', system: 'task' },
            chatId: 'cht_all',
            content: '📋 1 new task created: #1 "Audit the hosted export"',
            createdAt: '2026-07-26T12:00:00.000Z',
            id: 'msg_task_receipt',
            nonce: 'task-receipt:send-1',
            runId: null,
            sequence: 2,
            serverId: 'srv_main',
        })
    ).toMatchObject({ author: { kind: 'system', system: 'task' } });
});

test('hosted sends allow attachment-only messages but reject empty messages', () => {
    expect(
        hostedChatSendInputSchema.parse({
            attachmentIds: ['att_one'],
            chatId: 'cht_all',
            content: '',
            nonce: 'send-attachment',
            serverId: 'srv_main',
        })
    ).toMatchObject({ attachmentIds: ['att_one'], content: '' });

    expect(() =>
        hostedChatSendInputSchema.parse({
            attachmentIds: [],
            chatId: 'cht_all',
            content: '   ',
            nonce: 'send-empty',
            serverId: 'srv_main',
        })
    ).toThrow();

    expect(() =>
        hostedChatSendInputSchema.parse({
            attachmentIds: ['att_one', 'att_one'],
            chatId: 'cht_all',
            content: 'Duplicate.',
            nonce: 'send-duplicate',
            serverId: 'srv_main',
        })
    ).toThrow();
});
