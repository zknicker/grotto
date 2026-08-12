import { expect, test } from 'bun:test';
import type {
    HostedAgentCommand,
    HostedAgentExecutionJournalResult,
    SignedComputerRelease,
} from '@tavern/api';
import { ComputerConnections } from '../src/computers/connections.ts';

const computerId = 'cmp_1234567890123456';
const start: HostedAgentCommand = {
    agentId: 'agt_1234567890123456',
    chatId: 'cht_1234567890123456',
    modelId: 'model',
    prompt: 'work',
    runId: 'run_1234567890123456',
    runtimeId: 'runtime',
    type: 'start',
};
const stop: HostedAgentCommand = {
    agentId: start.agentId,
    runId: start.runId,
    type: 'stop',
};
const release = {
    release: {
        artifactUrl:
            'https://releases.grotto.sh/computer/1.1.0/grotto-computer-aarch64-apple-darwin',
        protocolVersion: 3,
        sha256: 'a'.repeat(64),
        sourceRevision: 'b'.repeat(40),
        version: '1.1.0',
    },
    signature: Buffer.alloc(64, 1).toString('base64'),
} satisfies SignedComputerRelease;

test('update-required permits signed update control but rejects ordinary work', () => {
    const frames: unknown[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: false,
        send: (frame) => frames.push(frame),
        serverId: 'srv_1234567890123456',
        updatePhase: 'idle',
    });

    expect(connections.send(computerId, start)).toBe(false);
    expect(connections.sendUpdate(computerId, release)).toBe(true);
    expect(frames).toEqual([{ release, type: 'update' }]);
});

test('waiting for Agents closes admission until reconnect completes', () => {
    const frames: unknown[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(frame),
        serverId: 'srv_1234567890123456',
        updatePhase: 'installing',
    });
    expect(connections.send(computerId, start)).toBe(false);

    connections.setUpdatePhase(computerId, 'waiting-for-agents');
    expect(connections.send(computerId, start)).toBe(false);
    expect(connections.send(computerId, stop)).toBe(true);

    connections.setUpdatePhase(computerId, 'complete');
    expect(connections.send(computerId, start)).toBe(true);
    expect(frames).toEqual([stop, start]);
});

test('skill imports resolve on durable acceptance from the requested Computer and Agent', async () => {
    const frames: Record<string, unknown>[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(frame as Record<string, unknown>),
        serverId: 'srv_1234567890123456',
        updatePhase: 'idle',
    });

    const pending = connections.requestSkillImport(computerId, {
        agentId: start.agentId,
        sourceId: 'hsk_1234567890123456',
    });
    const requestId = String(frames[0]?.requestId);
    expect(frames[0]).toEqual({
        agentId: start.agentId,
        requestId,
        sourceId: 'hsk_1234567890123456',
        type: 'agent-skill-import',
    });
    expect(
        connections.acceptSkillImport('cmp_0000000000000000', {
            agentId: start.agentId,
            requestId,
            sourceId: 'hsk_1234567890123456',
            status: 'accepted',
            type: 'agent-skill-import-result',
            updatedAt: '2026-07-27T00:00:00.000Z',
        })
    ).toBe(false);

    expect(
        connections.acceptSkillImport(computerId, {
            agentId: start.agentId,
            requestId,
            sourceId: 'hsk_1234567890123456',
            status: 'accepted',
            type: 'agent-skill-import-result',
            updatedAt: '2026-07-27T00:00:00.000Z',
        })
    ).toBe(true);
    expect(await pending).toEqual({ requestId, status: 'accepted' });
});

test('workspace relay accepts a response only from the requested Computer and Agent', async () => {
    const frames: Record<string, unknown>[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(frame as Record<string, unknown>),
        serverId: 'srv_1234567890123456',
        updatePhase: 'idle',
    });

    const pending = connections.requestWorkspace(computerId, {
        agentId: start.agentId,
        operation: { includeHidden: true, kind: 'list', path: '' },
    });
    const requestId = String(frames[0]?.requestId);
    expect(frames[0]).toEqual({
        agentId: start.agentId,
        operation: { includeHidden: true, kind: 'list', path: '' },
        requestId,
        type: 'agent-workspace-request',
    });
    const result = {
        kind: 'list' as const,
        value: {
            entries: [],
            path: '',
            workspaceRoot: '/computer/agent/workspace',
        },
    };
    expect(
        connections.acceptWorkspaceResult('cmp_0000000000000000', {
            agentId: start.agentId,
            requestId,
            result,
            type: 'agent-workspace-result',
        })
    ).toBe(false);
    expect(
        connections.acceptWorkspaceResult(computerId, {
            agentId: start.agentId,
            requestId,
            result,
            type: 'agent-workspace-result',
        })
    ).toBe(true);
    expect(await pending).toEqual(result);
});

test('Agent skill file bytes relay only from the requested Computer and Agent', async () => {
    const frames: Record<string, unknown>[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(frame as Record<string, unknown>),
        serverId: 'srv_1234567890123456',
        updatePhase: 'idle',
    });

    const pending = connections.requestSkillFile(computerId, {
        agentId: start.agentId,
        operation: { kind: 'read', name: 'research' },
    });
    const requestId = String(frames[0]?.requestId);
    expect(frames[0]).toEqual({
        agentId: start.agentId,
        operation: { kind: 'read', name: 'research' },
        requestId,
        type: 'agent-skill-file-request',
    });
    const result = {
        kind: 'read' as const,
        value: {
            content: '# Research\n',
            hash: 'a'.repeat(64),
            name: 'research',
            updatedAt: '2026-07-27T00:00:00.000Z',
        },
    };
    expect(
        connections.acceptSkillFileResult('cmp_0000000000000000', {
            agentId: start.agentId,
            requestId,
            result,
            type: 'agent-skill-file-result',
        })
    ).toBe(false);
    expect(
        connections.acceptSkillFileResult(computerId, {
            agentId: start.agentId,
            requestId,
            result,
            type: 'agent-skill-file-result',
        })
    ).toBe(true);
    expect(await pending).toEqual(result);
});

test('Browser relay accepts a response only from the requested Computer', async () => {
    const frames: Record<string, unknown>[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(frame as Record<string, unknown>),
        serverId: 'srv_1234567890123456',
        updatePhase: 'idle',
    });

    const pending = connections.requestBrowser(computerId, { kind: 'get' });
    const requestId = String(frames[0]?.requestId);
    expect(frames[0]).toEqual({
        operation: { kind: 'get' },
        requestId,
        type: 'browser-request',
    });
    const result = {
        kind: 'settings' as const,
        value: {
            affectedAgents: [],
            application: null,
            enabled: false,
            profileName: 'default',
            skillConflict: null,
            status: null,
            updatedAt: null,
        },
    };
    expect(
        connections.acceptBrowserResult('cmp_0000000000000000', {
            requestId,
            result,
            type: 'browser-result',
        })
    ).toBe(false);
    expect(
        connections.acceptBrowserResult(computerId, {
            requestId,
            result,
            type: 'browser-result',
        })
    ).toBe(true);
    expect(await pending).toEqual(result);
});

test('execution journal relay is paired to the assigned Computer, Agent, and run', async () => {
    const frames: Record<string, unknown>[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(frame as Record<string, unknown>),
        serverId: 'srv_1234567890123456',
        updatePhase: 'idle',
    });

    const pending = connections.requestExecutionJournal(computerId, {
        agentId: start.agentId,
        runId: start.runId,
        serverId: 'srv_1234567890123456',
    });
    const requestId = String(frames[0]?.requestId);
    expect(frames[0]).toEqual({
        agentId: start.agentId,
        requestId,
        runId: start.runId,
        type: 'agent-execution-journal-request',
    });
    const available: HostedAgentExecutionJournalResult = {
        agentId: start.agentId,
        journal: {
            runId: start.runId,
            startedAt: '2026-08-11T00:00:00.000Z',
            status: 'completed',
            tools: [],
        },
        requestId,
        runId: start.runId,
        status: 'available',
        type: 'agent-execution-journal-result',
    };
    expect(connections.acceptExecutionJournalResult('cmp_0000000000000000', available)).toBe(false);
    expect(
        connections.acceptExecutionJournalResult(computerId, {
            ...available,
            agentId: 'agt_0000000000000000',
        })
    ).toBe(false);
    expect(connections.acceptExecutionJournalResult(computerId, available)).toBe(true);
    expect(await pending).toEqual(available);
});

test('execution journal detail is explicitly unavailable when its Computer is offline', async () => {
    const connections = new ComputerConnections();
    await expect(
        connections.requestExecutionJournal('cmp_missing', {
            agentId: start.agentId,
            runId: start.runId,
            serverId: 'srv_1234567890123456',
        })
    ).resolves.toMatchObject({
        reason: 'offline',
        runId: start.runId,
        status: 'unavailable',
    });
});

test('execution journal relay refuses a Computer attached to another Server', async () => {
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: () => undefined,
        serverId: 'srv_1234567890123456',
        updatePhase: 'idle',
    });

    await expect(
        connections.requestExecutionJournal(computerId, {
            agentId: start.agentId,
            runId: start.runId,
            serverId: 'srv_other123456789012',
        })
    ).resolves.toMatchObject({ reason: 'offline', status: 'unavailable' });
});
