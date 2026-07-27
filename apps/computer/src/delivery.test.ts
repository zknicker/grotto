import { afterEach, beforeEach, expect, test } from 'bun:test';
import { lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    decideStart,
    noticePath,
    purgeServerPartition,
    type RunMarker,
    readRunMarker,
    reserveRun,
    writePendingNotice,
    writeRunMarker,
} from './delivery.ts';
import type { HostedAgentTurnFrame } from './launch.ts';
import { parseNoticeCommand, parseServerDeleteCommand } from './launch.ts';

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
    outputProduced: true,
    runId: 'run_x',
    startedAt: '2026-07-27T00:00:00.000Z',
    status: 'completed',
    summary: 'done',
    type: 'turn',
};

test('a fresh run with no marker launches', () => {
    expect(decideStart(null)).toEqual({ kind: 'run' });
});

test('a settled run replays its stored summary instead of re-running', () => {
    const marker: RunMarker = { status: 'settled', summary };
    expect(decideStart(marker)).toEqual({ kind: 'replay', summary });
});

test('an accepted-but-unsettled run recovers as failed, never re-runs', () => {
    // A crash after acceptance must not rerun possibly-effectful work.
    expect(decideStart({ status: 'accepted' })).toEqual({ kind: 'recover' });
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
    expect(decideStart(marker)).toEqual({ kind: 'replay', summary });
});

test('a missing marker reads as null', async () => {
    expect(await readRunMarker(dataRoot, { runId: 'run_absent' }, serverId)).toBeNull();
});

test('an interrupted (accepted-only) run recovers, then replays its terminal result', async () => {
    // A crash leaves only an accepted marker: recovery, never rerun.
    await writeRunMarker(dataRoot, { marker: { status: 'accepted' }, runId: 'run_x', serverId });
    expect(decideStart(await readRunMarker(dataRoot, { runId: 'run_x' }, serverId))).toEqual({
        kind: 'recover',
    });

    // Recovery reports a failed, interrupted turn and settles the marker, so a
    // later redelivery replays that terminal result instead of recovering again.
    const interrupted: HostedAgentTurnFrame = {
        ...summary,
        outputProduced: true,
        status: 'failed',
    };
    await writeRunMarker(dataRoot, {
        marker: { status: 'settled', summary: interrupted },
        runId: 'run_x',
        serverId,
    });
    expect(decideStart(await readRunMarker(dataRoot, { runId: 'run_x' }, serverId))).toEqual({
        kind: 'replay',
        summary: interrupted,
    });
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

test('a Server deletion command is exact and content-free', () => {
    expect(parseServerDeleteCommand({ type: 'server-delete' })).toEqual({
        type: 'server-delete',
    });
    expect(parseServerDeleteCommand({ serverId, type: 'server-delete' })).toBeNull();
});

test('Server cleanup waits for local writers before removing their partition', async () => {
    let releaseWriter: () => void = () => {};
    const writer = new Promise<void>((resolve) => {
        releaseWriter = resolve;
    }).then(() => mkdir(join(dataRoot, 'servers', serverId), { recursive: true }));
    const purge = purgeServerPartition(dataRoot, serverId, [writer]);

    releaseWriter();
    await purge;
    await expect(lstat(join(dataRoot, 'servers', serverId))).rejects.toMatchObject({
        code: 'ENOENT',
    });
});

test('parseNoticeCommand fails closed on a malformed frame', () => {
    expect(parseNoticeCommand({ agentId: 'agt_x', runId: 'run_x', type: 'notice' })).toBeNull();
    expect(parseNoticeCommand({ pending: 1, runId: 'run_x', type: 'notice' })).toBeNull();
    expect(parseNoticeCommand({ type: 'start' })).toBeNull();
});
