import { expect, test } from 'bun:test';
import type { AgentCreatePreparedAction, ChatMessage } from '@grotto/api';
import { buildTranscriptEntries, getItemRunId } from '../../chats/chat-transcript-model.ts';
import { mergeTaskAnchor, projectChatMessages } from './chat-message-model.ts';

test('keeps an older task anchor available when the latest transcript page omits it', () => {
    const anchor = message('message_anchor', 1);
    const latest = message('message_latest', 51);

    expect(mergeTaskAnchor([latest], anchor)).toEqual([anchor, latest]);
    expect(mergeTaskAnchor([anchor, latest], anchor)).toEqual([anchor, latest]);
});

test('projects Server messages into the preserved transcript contract', () => {
    const human = message('message_human', 1);
    human.attachments = [
        {
            filename: 'map.txt',
            id: 'attachment_one',
            mediaType: 'text/plain',
            sizeBytes: 42,
        },
    ];
    const agent: ChatMessage = {
        ...message('message_agent', 2),
        author: { agentId: 'agent_one', kind: 'agent' },
        runId: 'run_agent',
    };
    const rows = projectChatMessages(
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
    expect(agentRow?.kind === 'message' ? agentRow.runId : null).toBe('run_agent');

    const agentEntry = buildTranscriptEntries({ rows }).find(
        (entry) => entry.kind === 'turn' && entry.participant === 'agent'
    );
    expect(agentEntry?.kind === 'turn' ? agentEntry.id : null).toBe('turn:run_agent');
    expect(
        agentEntry?.kind === 'turn' && agentEntry.items[0]
            ? getItemRunId(agentEntry.items[0])
            : null
    ).toBe('run_agent');
});

test('preserves one global Agent run identity when messages come from multiple Chats', () => {
    const runId = 'run_global';
    const first: ChatMessage = {
        ...message('message_first', 1),
        author: { agentId: 'agent_one', kind: 'agent' },
        chatId: 'chat_first',
        runId,
    };
    const second: ChatMessage = {
        ...message('message_second', 2),
        author: { agentId: 'agent_one', kind: 'agent' },
        chatId: 'chat_second',
        runId,
    };

    const rows = projectChatMessages([first, second], []);

    expect(
        rows
            .filter((row) => row.kind === 'message')
            .map((row) => (row.kind === 'message' ? row.runId : null))
    ).toEqual([runId, runId]);
});

test('projects a prepared action alongside its empty Chat anchor', () => {
    const action: AgentCreatePreparedAction = {
        chatId: 'chat_one',
        createdAt: '2026-08-25T12:00:00.000Z',
        executedAt: null,
        executedByUserId: null,
        id: 'act_1234567890abcdef',
        kind: 'agent:create',
        messageId: 'message_action',
        proposerAgentId: 'agent_one',
        proposal: {
            avatar: {
                byteSize: 8,
                id: 'pam_1234567890abcdef',
                mediaType: 'image/png',
                sha256: 'a'.repeat(64),
                url: '/api/prepared-action-media/pam_1234567890abcdef',
            },
            computer: null,
            description: null,
            draftHint: null,
            kind: 'agent:create',
            name: 'Orbit',
        },
        status: 'pending',
        supersededAt: null,
        supersededByActionId: null,
    };
    const row = projectChatMessages(
        [
            {
                ...message('message_action', 1),
                author: { agentId: 'agent_one', kind: 'agent' },
                content: '',
                preparedAction: action,
                runId: 'run_agent',
            },
        ],
        []
    )[0];

    expect(row?.kind === 'message' ? row.message.preparedAction : null).toBe(action);
});

function message(id: string, sequence: number): ChatMessage {
    return {
        attachments: [],
        author: { kind: 'human', userId: 'user_one' },
        body: { kind: 'text' },
        chatId: 'chat_one',
        content: id,
        createdAt: '2026-07-26T12:00:00.000Z',
        id,
        nonce: `nonce_${id}`,
        runId: null,
        sequence,
        serverId: 'server_one',
        sessionGeneration: null,
    };
}
