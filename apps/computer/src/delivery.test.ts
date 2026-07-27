import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    decideStart,
    noticePath,
    type RunMarker,
    readRunMarker,
    reserveRun,
    writePendingNotice,
    writeRunMarker,
} from './delivery.ts';
import type { HostedAgentTurnFrame } from './launch.ts';
import { parseNoticeCommand } from './launch.ts';

let dataRoot: string;
const serverId = 'srv_deliverytest0000';

beforeEach(async () => {
    dataRoot = await mkdtemp(join(tmpdir(), 'grotto-delivery-'));
});

afterEach(async () => {
    await rm(dataRoot, { force: true, recursive: true });
});

const summary: HostedAgentTurnFrame = {
    agentId: 'agt_x',
    endedAt: '2026-07-27T00:00:01.000Z',
    messageCount: 1,
    runId: 'run_x',
    startedAt: '2026-07-27T00:00:00.000Z',
    status: 'completed',
    summary: 'done',
    type: 'turn',
};

test('a fresh run with no marker launches', () => {
    expect(decideStart(null, false)).toEqual({ kind: 'run' });
});

test('a duplicate frame for a live run is skipped, not relaunched', () => {
    expect(decideStart(null, true)).toEqual({ kind: 'skip' });
});

test('a settled run replays its stored summary instead of re-running', () => {
    const marker: RunMarker = { status: 'settled', summary };
    expect(decideStart(marker, false)).toEqual({ kind: 'replay', summary });
});

test('an accepted-but-unsettled run re-runs after a crash', () => {
    expect(decideStart({ status: 'accepted' }, false)).toEqual({ kind: 'run' });
});

test('run markers survive a Computer restart and drive idempotent replay', async () => {
    await writeRunMarker(dataRoot, {
        marker: { status: 'accepted' },
        runId: 'run_x',
        serverId,
    });
    await writeRunMarker(dataRoot, {
        marker: { status: 'settled', summary },
        runId: 'run_x',
        serverId,
    });

    // A new process re-reads the durable marker from disk; a redelivered start
    // frame resolves to a replay, so the model never sees the run twice.
    const marker = await readRunMarker(dataRoot, { runId: 'run_x' }, serverId);
    expect(marker).toEqual({ status: 'settled', summary });
    expect(decideStart(marker, false)).toEqual({ kind: 'replay', summary });
});

test('a missing marker reads as null', async () => {
    expect(await readRunMarker(dataRoot, { runId: 'run_absent' }, serverId)).toBeNull();
});

test('reserveRun admits a fresh run once and rejects a concurrent duplicate', () => {
    const running = new Map<string, AbortController>();
    const first = reserveRun(running, 'run_x');
    expect(first).not.toBeNull();
    // A duplicate start frame for the same run — before the first launch finishes
    // — is rejected synchronously, so no second child can spawn.
    expect(reserveRun(running, 'run_x')).toBeNull();
    running.delete('run_x');
    expect(reserveRun(running, 'run_x')).not.toBeNull();
});

test('a content-free notice parses and is recorded for the running turn', async () => {
    const notice = parseNoticeCommand({
        agentId: 'agt_x',
        pending: 3,
        runId: 'run_x',
        type: 'notice',
    });
    expect(notice).toEqual({ agentId: 'agt_x', pending: 3, runId: 'run_x', type: 'notice' });

    await writePendingNotice(dataRoot, { agentId: 'agt_x', pending: 3, serverId });
    const written = JSON.parse(
        await readFile(noticePath(dataRoot, { agentId: 'agt_x', serverId }), 'utf8')
    );
    // Content-free: only a count is recorded, never message content.
    expect(written).toEqual({ pending: 3 });
});

test('parseNoticeCommand fails closed on a malformed frame', () => {
    expect(parseNoticeCommand({ agentId: 'agt_x', runId: 'run_x', type: 'notice' })).toBeNull();
    expect(parseNoticeCommand({ pending: 1, runId: 'run_x', type: 'notice' })).toBeNull();
    expect(parseNoticeCommand({ type: 'start' })).toBeNull();
});
