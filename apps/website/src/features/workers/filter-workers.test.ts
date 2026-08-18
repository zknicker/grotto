import { describe, expect, test } from 'bun:test';
import type { TranscriptWorker } from '../chats/transcript-contract.ts';
import { filterWorkers } from './filter-workers.ts';

const workers: TranscriptWorker[] = [
    {
        agentId: 'tiny',
        agentName: 'Tiny',
        chatTitle: '#general',
        childSessionKey: 'agent:tiny:subagent:child-1',
        cleanupAfter: null,
        createdAt: '2026-03-31T12:00:00.000Z',
        description: 'Investigate auth bug',
        detail: 'Investigating auth',
        deliveryStatus: 'pending',
        endedAt: null,
        error: null,
        executionMode: 'detached_session',
        id: 'worker-1',
        kind: 'subagent',
        lastEventAt: '2026-03-31T12:05:00.000Z',
        notifyPolicy: 'done_only',
        parentWorkerId: null,
        progressSummary: 'Investigating auth',
        requesterSessionKey: 'agent:tiny:main',
        runId: 'run-1',
        sessionKey: 'agent:tiny:subagent:child-1',
        source: 'agentRuntime',
        sourceFlowId: null,
        sourceId: 'task-1',
        startedAt: '2026-03-31T12:01:00.000Z',
        status: 'running',
        syncedAt: '2026-03-31T12:06:00.000Z',
        terminalSummary: null,
        title: 'Investigate auth bug',
    },
    {
        agentId: 'tiny',
        agentName: 'Tiny',
        chatTitle: null,
        childSessionKey: null,
        cleanupAfter: null,
        createdAt: '2026-03-31T13:00:00.000Z',
        description: 'Reminder Poller',
        detail: 'Reminder sent',
        deliveryStatus: 'not_applicable',
        endedAt: '2026-03-31T13:01:00.000Z',
        error: null,
        executionMode: 'unknown',
        id: 'worker-2',
        kind: 'cron',
        lastEventAt: '2026-03-31T13:01:00.000Z',
        notifyPolicy: 'silent',
        parentWorkerId: null,
        progressSummary: null,
        requesterSessionKey: null,
        runId: 'run-2',
        sessionKey: null,
        source: 'agentRuntime',
        sourceFlowId: null,
        sourceId: 'task-2',
        startedAt: '2026-03-31T13:00:00.000Z',
        status: 'succeeded',
        syncedAt: '2026-03-31T13:02:00.000Z',
        terminalSummary: 'Reminder sent',
        title: 'Reminder Poller',
    },
];

describe('filterWorkers', () => {
    test('filters by worker kind', () => {
        const result = filterWorkers({
            filter: 'cron',
            query: '',
            workers,
        });

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('worker-2');
    });

    test('matches query against worker summaries and ids', () => {
        const result = filterWorkers({
            filter: 'all',
            query: 'auth',
            workers,
        });

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('worker-1');
    });
});
