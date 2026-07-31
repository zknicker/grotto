import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpLink } from '@trpc/client';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import { type AgentListOutput, trpc } from '../../lib/trpc.tsx';
import { ChatActiveStatusStack, formatActiveStatusText } from './chat-active-status-stack.tsx';
import type { TranscriptRow } from './chat-transcript-model.ts';

// The stack reads live presence, so tests render inside inert tRPC/query
// providers (no requests are issued during static render).
function renderStack(children: React.ReactElement) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const client = trpc.createClient({
        links: [httpLink({ url: 'http://127.0.0.1:1/trpc' })],
    });
    return renderToStaticMarkup(
        <trpc.Provider client={client} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </trpc.Provider>
    );
}

const activeReply = {
    agentId: 'agent-1',
    isThinking: true,
    runId: 'run-1',
    sessionKey: 'agent:agent-1:session-1',
    startedAt: '2026-07-01T17:00:00.000Z',
    text: '',
} satisfies ChatActiveReply;

const agents = [
    {
        effectivePrimaryColor: '#166534',
        id: 'agent-1',
        name: 'Blippy',
    },
] as AgentListOutput['agents'];

test('ChatActiveStatusStack renders active agent status above the composer', () => {
    const markup = renderStack(
        <ChatActiveStatusStack activeReplies={[activeReply]} agents={agents} rows={[]} />
    );

    assert.match(markup, /aria-label="Active agent status"/);
    assert.match(markup, /Blippy is thinking\.\.\./);
    assert.match(markup, /thinking-indicator-text/);
});

test('ChatActiveStatusStack follows current work state from active progress rows', () => {
    const markup = renderStack(
        <ChatActiveStatusStack
            activeReplies={[activeReply]}
            agents={agents}
            rows={[
                {
                    actor: { id: 'agent-1', kind: 'agent' },
                    completedAt: null,
                    connectsToNext: false,
                    connectsToPrevious: false,
                    id: 'act_run-1_tool_1',
                    isFirstInGroup: true,
                    kind: 'tool',
                    sessionKey: 'agent:agent-1:session-1',
                    spawnedRelationships: [],
                    startedAt: '2026-07-01T17:00:01.000Z',
                    toolCall: {
                        callId: 'call-1',
                        facts: [],
                        label: 'Listing files',
                        name: 'bash',
                        status: 'running',
                        summaryParts: ['Listing files'],
                    },
                } satisfies TranscriptRow,
            ]}
        />
    );

    assert.match(markup, /Blippy is working\.\.\./);
    assert.match(markup, /aria-label="Agent is working"/);
});

test('ChatActiveStatusStack streams a cumulative work summary and offers turn details', () => {
    const toolRow = (id: string, name: string, summary: string) =>
        ({
            actor: { id: 'agent-1', kind: 'agent' },
            completedAt: '2026-07-01T17:00:02.000Z',
            connectsToNext: false,
            connectsToPrevious: false,
            id,
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: 'agent:agent-1:session-1',
            runId: 'run-1',
            spawnedRelationships: [],
            startedAt: '2026-07-01T17:00:01.000Z',
            toolCall: {
                callId: id,
                facts: [],
                label: summary,
                name,
                status: 'ok',
                summaryParts: [summary],
            },
        }) satisfies TranscriptRow;
    const markup = renderStack(
        <ChatActiveStatusStack
            activeReplies={[activeReply]}
            agents={agents}
            chatId="cht_test"
            rows={[]}
            turnEvidence={{
                'run-1': [
                    toolRow('act_run-1_tool_1', 'exec', 'ls -la'),
                    toolRow('act_run-1_tool_2', 'exec', 'bun run lint'),
                    toolRow('act_run-1_tool_3', 'read_file', 'docs/README.md'),
                ],
            }}
        />
    );

    assert.match(markup, /title="View turn details"/);
    // Cumulative intent summary rides next to the thinking label, led by the
    // work-group icon.
    assert.match(markup, /Listed files, read a file/);
    assert.match(markup, /size-3\.5 shrink-0/);
});

test('ChatActiveStatusStack renders one row per agent when a follow-up run is queued', () => {
    // A mention can queue an agent's next turn while its current one is still
    // finishing; the seat keeps a single status row through the handoff.
    const queuedReply = {
        ...activeReply,
        runId: 'run-2',
        startedAt: '2026-07-01T17:00:05.000Z',
    } satisfies ChatActiveReply;
    const markup = renderStack(
        <ChatActiveStatusStack
            activeReplies={[activeReply, queuedReply]}
            agents={agents}
            rows={[]}
        />
    );

    assert.equal(markup.split('thinking-indicator-text').length - 1, 1);
    assert.match(markup, /Blippy is thinking\.\.\./);
});

test('ChatActiveStatusStack keeps quiet peer-evaluation turns invisible until text streams', () => {
    const quietReply = {
        ...activeReply,
        text: '',
        trigger: 'evaluation',
    } satisfies ChatActiveReply;
    const quietMarkup = renderStack(
        <ChatActiveStatusStack activeReplies={[quietReply]} agents={agents} rows={[]} />
    );
    assert.equal(quietMarkup, '');

    // The moment reply text streams, the row appears like any other turn.
    const speakingMarkup = renderStack(
        <ChatActiveStatusStack
            activeReplies={[{ ...quietReply, text: 'On it —' }]}
            agents={agents}
            rows={[]}
        />
    );
    assert.match(speakingMarkup, /Blippy/);
});

test('ChatActiveStatusStack does not render without an active reply', () => {
    const markup = renderStack(
        <ChatActiveStatusStack activeReplies={[]} agents={agents} rows={[]} />
    );

    assert.equal(markup, '');
});

test('ChatActiveStatusStack renders nothing while idle', () => {
    const markup = renderStack(
        <ChatActiveStatusStack activeReplies={[]} agents={agents} rows={[]} variant="detail" />
    );

    // An empty stack needs no idle placeholder and cannot move the layout.
    assert.doesNotMatch(markup, /aria-label="Active agent status"/);
});

test('status text: streaming is typing, default thinks', () => {
    assert.equal(
        formatActiveStatusText({
            activeReply: { ...activeReply, isThinking: false, text: 'On it —' },
            agentName: 'Blippy',
            rows: [],
        }),
        'Blippy is typing...'
    );
    assert.equal(
        formatActiveStatusText({
            activeReply,
            agentName: 'Blippy',
            rows: [],
        }),
        'Blippy is thinking...'
    );
});
