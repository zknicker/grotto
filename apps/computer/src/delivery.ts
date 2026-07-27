import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HostedAgentStartCommand, HostedAgentTurnFrame } from './launch.ts';

/**
 * A Computer-local, restart-durable record of one run. `accepted` is written the
 * instant the Computer commits to a start (its local acceptance); `settled` adds
 * the final turn summary. Duplicate or replayed start frames are resolved
 * against this marker, so a run is never launched twice and a lost turn summary
 * is replayed instead of re-run.
 */
export interface RunMarker {
    status: 'accepted' | 'settled';
    summary?: HostedAgentTurnFrame;
}

export type StartDecision =
    | { kind: 'replay'; summary: HostedAgentTurnFrame }
    | { kind: 'skip' }
    | { kind: 'run' };

/**
 * Decides how a start command should be handled given the durable marker and
 * whether the run is already executing in this process:
 * - a settled marker → replay its summary (the Server missed the turn frame),
 * - already running → skip (a duplicate frame mid-turn; the ack still resends),
 * - otherwise → run it fresh (no marker, or an `accepted` marker from a crash).
 */
export function decideStart(marker: RunMarker | null, alreadyRunning: boolean): StartDecision {
    if (marker?.status === 'settled' && marker.summary) {
        return { kind: 'replay', summary: marker.summary };
    }
    if (alreadyRunning) {
        return { kind: 'skip' };
    }
    return { kind: 'run' };
}

/**
 * Reserves a run slot synchronously, before any async marker I/O. Returns the
 * new controller when the run is fresh, or null when it is already reserved or
 * live — the guard that stops a duplicate start frame from racing into a second
 * concurrent child.
 */
export function reserveRun(
    running: Map<string, AbortController>,
    runId: string
): AbortController | null {
    if (running.has(runId)) {
        return null;
    }
    const controller = new AbortController();
    running.set(runId, controller);
    return controller;
}

export async function readRunMarker(
    dataRoot: string,
    command: Pick<HostedAgentStartCommand, 'runId'>,
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
 * a running turn can read it at a safe boundary. The notice carries only a count,
 * never message content — the queued work itself becomes model-visible when the
 * Server drains it into the next turn.
 */
export async function writePendingNotice(
    dataRoot: string,
    input: { agentId: string; pending: number; serverId: string }
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
    await writeFile(temporary, `${JSON.stringify({ pending: input.pending })}\n`, { mode: 0o600 });
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
