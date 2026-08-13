import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentStartCommand, AgentTurnFrame } from './launch.ts';

/**
 * A Computer-local, restart-durable record of one run. `accepted` is written the
 * instant the Computer commits to a start (its local acceptance); `settled` adds
 * the final turn summary. Duplicate or replayed start frames are resolved
 * against this marker. Concurrent duplicates are suppressed; an accepted run
 * replays after a process crash because acceptance is not model-seen proof.
 */
export interface RunMarker {
    status: 'accepted' | 'settled';
    summary?: AgentTurnFrame;
}

export interface StoredNoticeReceipt {
    messageIds: string[];
    runId: string;
}

export type StartDecision = { kind: 'replay'; summary: AgentTurnFrame } | { kind: 'run' };

export async function purgeServerPartition(
    dataRoot: string,
    serverId: string,
    pendingWriters: Iterable<Promise<unknown>>
): Promise<void> {
    if (!/^srv_[A-Za-z0-9_-]{16}$/u.test(serverId)) {
        throw new Error('Invalid Server id.');
    }
    await Promise.allSettled([...pendingWriters]);
    await rm(join(dataRoot, 'servers', serverId), { force: true, recursive: true });
}

/**
 * Decides how a start command should be handled given the durable marker (a
 * duplicate frame for a live run is already deduped synchronously by
 * {@link reserveRun}):
 * - a settled marker → replay its summary (the Server missed the turn frame),
 * - an `accepted` marker → rerun: acceptance is transport evidence, not proof
 *   that the model saw the inbox. At-least-once replay after a crash is
 *   intentional; losing unseen work is not,
 * - otherwise → run it fresh.
 */
export function decideStart(marker: RunMarker | null): StartDecision {
    if (marker?.status === 'settled' && marker.summary) {
        return { kind: 'replay', summary: marker.summary };
    }
    return { kind: 'run' };
}

/**
 * Reserves a run slot synchronously, before any async marker I/O. Returns the
 * new controller when the run is fresh, or null when it is already reserved or
 * live — the guard that stops a duplicate start frame from racing into a second
 * concurrent child.
 */
export type AgentRunReservation =
    | { controller: AbortController; kind: 'reserved' }
    | { kind: 'busy' }
    | { kind: 'duplicate' };

export function reserveAgentRun(
    running: Map<string, AbortController>,
    agentRuns: Map<string, string>,
    agentId: string,
    runId: string
): AgentRunReservation {
    if (running.has(runId)) {
        return { kind: 'duplicate' };
    }
    if (agentRuns.has(agentId)) {
        return { kind: 'busy' };
    }
    const controller = new AbortController();
    running.set(runId, controller);
    agentRuns.set(agentId, runId);
    return { controller, kind: 'reserved' };
}

export function releaseAgentRun(
    running: Map<string, AbortController>,
    agentRuns: Map<string, string>,
    agentId: string,
    runId: string
): void {
    running.delete(runId);
    if (agentRuns.get(agentId) === runId) {
        agentRuns.delete(agentId);
    }
}

export async function readRunMarker(
    dataRoot: string,
    command: Pick<AgentStartCommand, 'runId'>,
    serverId: string
): Promise<RunMarker | null> {
    try {
        return JSON.parse(await readFile(markerPath(dataRoot, serverId, command.runId), 'utf8'));
    } catch {
        return null;
    }
}

export async function writeRunMarker(
    dataRoot: string,
    input: { marker: RunMarker; runId: string; serverId: string }
): Promise<void> {
    const destination = markerPath(dataRoot, input.serverId, input.runId);
    await mkdir(join(dataRoot, 'servers', input.serverId, 'runs'), {
        mode: 0o700,
        recursive: true,
    });
    const temporary = `${destination}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temporary, `${JSON.stringify(input.marker)}\n`, { mode: 0o600 });
    await rename(temporary, destination);
}

function markerPath(dataRoot: string, serverId: string, runId: string): string {
    return join(dataRoot, 'servers', serverId, 'runs', `${runId}.json`);
}

/**
 * Records a content-free notice for a busy Agent in its runtime directory, where
 * a running turn can read it at a safe boundary. The notice never carries message
 * content; bodies become model-visible only when the Agent checks messages.
 */
export async function writePendingNotice(
    dataRoot: string,
    input: {
        agentId: string;
        notice: string;
        receipt?: StoredNoticeReceipt;
        serverId: string;
    }
): Promise<void> {
    const runtimeDir = join(
        dataRoot,
        'servers',
        input.serverId,
        'agents',
        input.agentId,
        'runtime'
    );
    await mkdir(runtimeDir, { mode: 0o700, recursive: true });
    const destination = join(runtimeDir, 'pending-notice.json');
    const temporary = `${destination}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(
        temporary,
        `${JSON.stringify({ notice: input.notice, receipt: input.receipt })}\n`,
        { mode: 0o600 }
    );
    await rename(temporary, destination);
}

export function noticePath(dataRoot: string, input: { agentId: string; serverId: string }): string {
    return join(
        dataRoot,
        'servers',
        input.serverId,
        'agents',
        input.agentId,
        'runtime',
        'pending-notice.json'
    );
}
