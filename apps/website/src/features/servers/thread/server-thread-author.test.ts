import { expect, test } from 'bun:test';
import type { HostedAgent, HostedChatMessage } from '@tavern/api';
import { serverThreadAuthor } from './server-thread-author.ts';

test('projects an Agent thread reply as its Agent identity', () => {
    const agent = { displayName: 'Otto', id: 'agent_otto' } as HostedAgent;
    const author = serverThreadAuthor(agentMessage(), new Map([[agent.id, agent]]));

    expect(author).toEqual({ agent, kind: 'agent' });
});

test('keeps reminder system rows distinct from Agent replies', () => {
    const reminder = {
        ...agentMessage(),
        author: { kind: 'system' as const, system: 'reminder' as const },
    };

    expect(serverThreadAuthor(reminder, new Map())).toEqual({
        kind: 'reminder',
        label: 'Reminder',
    });
});

test('projects task receipts with the Server system identity', () => {
    const taskReceipt = {
        ...agentMessage(),
        author: { kind: 'system' as const, system: 'task' as const },
        content: '📋 1 new task created: #1 "Audit the hosted export"',
    };

    expect(serverThreadAuthor(taskReceipt, new Map())).toEqual({
        kind: 'system',
        label: 'Grotto',
    });
});

function agentMessage(): HostedChatMessage {
    return {
        attachments: [],
        author: { agentId: 'agent_otto', kind: 'agent' },
        chatId: 'chat_product',
        content: 'Thread reply',
        createdAt: '2026-07-29T12:00:00.000Z',
        id: 'message_reply',
        nonce: 'nonce_reply',
        sequence: 1,
        serverId: 'server_one',
    };
}
