import { expect, test } from 'bun:test';
import type { HostedChatMessage } from '@tavern/api';
import { mergeTaskAnchor } from './server-chat.tsx';
import { projectHostedChatMessages } from './server-chat-transcript.tsx';

test('keeps an older task anchor available when the latest transcript page omits it', () => {
    const anchor = message('message_anchor', 1);
    const latest = message('message_latest', 51);

    expect(mergeTaskAnchor([latest], anchor)).toEqual([anchor, latest]);
    expect(mergeTaskAnchor([anchor, latest], anchor)).toEqual([anchor, latest]);
});

test('projects hosted messages into the preserved transcript contract', () => {
    const human = message('message_human', 1);
    human.attachments = [
        {
            filename: 'map.txt',
            id: 'attachment_one',
            mediaType: 'text/plain',
            sizeBytes: 42,
        },
    ];
    const agent: HostedChatMessage = {
        ...message('message_agent', 2),
        author: { agentId: 'agent_one', kind: 'agent' },
    };
    const rows = projectHostedChatMessages(
        [human, agent],
        [
            {
                anchorMessageId: human.id,
                followed: true,
                latestReplyAt: agent.createdAt,
                recentReplies: [],
                replyCount: 1,
                threadChatId: 'thread_one',
                unreadCount: 0,
            },
        ]
    );
    const humanRow = rows[0];
    const agentRow = rows[1];

    expect(humanRow?.kind).toBe('message');
    expect(humanRow?.kind === 'message' ? humanRow.actor : null).toEqual({
        id: 'user_one',
        kind: 'participant',
    });
    expect(humanRow?.kind === 'message' ? humanRow.message.attachments?.[0] : null).toEqual({
        filename: 'map.txt',
        mediaType: 'text/plain',
        path: 'hosted:attachment_one',
        sizeBytes: 42,
        type: 'file',
    });
    expect(humanRow?.kind === 'message' ? humanRow.thread?.threadChatId : null).toBe('thread_one');
    expect(agentRow?.kind === 'message' ? agentRow.actor : null).toEqual({
        id: 'agent_one',
        kind: 'agent',
    });
    expect(agentRow?.kind === 'message' ? agentRow.runId : null).toBe('hosted:message_agent');
});

test('projects a hosted system receipt as a quiet Grotto timeline row', () => {
    const receipt: HostedChatMessage = {
        ...message('message_receipt', 2),
        author: { kind: 'system', system: 'task' },
        content: '📋 1 new task created: #1 "Audit the hosted export"',
    };

    const [row] = projectHostedChatMessages([receipt], []);

    expect(row).toMatchObject({
        actor: null,
        kind: 'message',
        message: {
            content: receipt.content,
            sender: 'Grotto',
            senderType: 'system',
        },
    });
});

function message(id: string, sequence: number): HostedChatMessage {
    return {
        attachments: [],
        author: { kind: 'human', userId: 'user_one' },
        chatId: 'chat_one',
        content: id,
        createdAt: '2026-07-26T12:00:00.000Z',
        id,
        nonce: `nonce_${id}`,
        sequence,
        serverId: 'server_one',
    };
}
