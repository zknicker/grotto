import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    parseExecutionJournalRequest,
    readExecutionJournalRequest,
} from './execution-journal-relay.ts';
import { createComputerExecutionJournal } from './harness/execution-journal.ts';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('serves one local journal only for the attached Server partition', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-journal-relay-'));
    roots.push(dataRoot);
    const journal = await createComputerExecutionJournal({
        agentRoot: join(dataRoot, 'servers', 'srv_attached', 'agents', 'agt_attached'),
        runId: 'run_attached',
    });
    await journal.finish('completed');

    const request = parseExecutionJournalRequest({
        agentId: 'agt_attached',
        requestId: 'req_detail',
        runId: 'run_attached',
        type: 'agent-execution-journal-request',
    });
    expect(request).not.toBeNull();
    await expect(
        readExecutionJournalRequest({
            dataRoot,
            request: request!,
            serverId: 'srv_attached',
        })
    ).resolves.toMatchObject({ status: 'available', journal: { runId: 'run_attached' } });
});

test('returns an explicit missing result instead of inventing local detail', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-journal-missing-'));
    roots.push(dataRoot);
    const request = parseExecutionJournalRequest({
        agentId: 'agt_missing',
        requestId: 'req_missing',
        runId: 'run_missing',
        type: 'agent-execution-journal-request',
    });
    expect(request).not.toBeNull();
    await expect(
        readExecutionJournalRequest({ dataRoot, request: request!, serverId: 'srv_attached' })
    ).resolves.toEqual({
        agentId: 'agt_missing',
        reason: 'missing',
        requestId: 'req_missing',
        runId: 'run_missing',
        status: 'unavailable',
        type: 'agent-execution-journal-result',
    });
});

test('returns explicit missing for a run id that cannot address a local file', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-journal-invalid-'));
    roots.push(dataRoot);
    const request = parseExecutionJournalRequest({
        agentId: 'agt_invalid',
        requestId: 'req_invalid',
        runId: '../escape',
        type: 'agent-execution-journal-request',
    });
    expect(request).not.toBeNull();
    await expect(
        readExecutionJournalRequest({ dataRoot, request: request!, serverId: 'srv_attached' })
    ).resolves.toMatchObject({ reason: 'missing', status: 'unavailable' });
});
