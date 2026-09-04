import type {
    AgentCloudAgentReceipt,
    CloudAgentCancelCommand,
    CloudAgentObservation,
    CloudAgentReconcileEntry,
} from '@grotto/api';
import { agentCloudAgentReceiptSchema } from '@grotto/api';
import {
    type CloudAgentProviderObservation,
    CloudAgentProviderUnavailableError,
    type CloudAgentRunRef,
} from './provider.ts';
import { cloudAgentProvider } from './registry.ts';

export interface CloudAgentStartRequest {
    content: string;
    /** The provider prompt. It stays on this Computer and never reaches Server. */
    instructions: string;
    nonce: string;
    repository: string;
    startingRef: string | null;
    target: string;
    title: string;
}

export class CloudAgentLaunchFailedError extends Error {
    readonly receipt: AgentCloudAgentReceipt;

    constructor(receipt: AgentCloudAgentReceipt, cause: unknown) {
        super(
            `The provider refused the launch: ${cause instanceof Error ? cause.message : String(cause)}`
        );
        this.name = 'CloudAgentLaunchFailedError';
        this.receipt = receipt;
    }
}

type ObservationSink = (observation: CloudAgentObservation) => void;

const reporters = new Map<string, ObservationSink>();
const liveRuns = new Map<string, () => void>();

/** Routes this attachment's observations up its Computer socket. */
export function setCloudAgentReporter(serverId: string, sink: ObservationSink | null): void {
    if (sink) {
        reporters.set(serverId, sink);
        return;
    }
    reporters.delete(serverId);
    for (const [key, unsubscribe] of liveRuns) {
        if (key.startsWith(`${serverId}:`)) {
            unsubscribe();
            liveRuns.delete(key);
        }
    }
}

/**
 * Runs one `grotto cloud-agent start`. Readiness is checked before Server is
 * asked for anything, so an unavailable capability creates no Message. Once
 * Server has accepted the launch the work exists: a provider refusal is
 * reported as a failed observation against that same work rather than erased.
 */
export async function startCloudAgentWork(input: {
    request: CloudAgentStartRequest;
    runnerToken: string;
    serverId: string;
    serverOrigin: string;
}): Promise<AgentCloudAgentReceipt> {
    const provider = cloudAgentProvider();
    const readiness = await provider.readiness();
    if (!readiness.ready) {
        throw new CloudAgentProviderUnavailableError(readiness.reason);
    }

    const { instructions, ...serverInput } = input.request;
    const response = await fetch(new URL('/api/agent/cloud-agents', input.serverOrigin), {
        body: JSON.stringify({ ...serverInput, provider: provider.provider }),
        headers: {
            authorization: `Bearer ${input.runnerToken}`,
            'content-type': 'application/json',
        },
        method: 'POST',
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new CloudAgentServerError(payload);
    }
    const receipt = agentCloudAgentReceiptSchema.parse(payload);
    const ref: CloudAgentRunRef = {
        providerAgentId: receipt.work.providerAgentId,
        providerRunId: receipt.work.runs[0]?.providerRunId ?? null,
        runId: receipt.runId,
        workId: receipt.work.id,
    };
    // A replayed nonce returns the work Server already recorded. Launching
    // again would strand a second provider agent against a Run that is already
    // running or settled, so reconcile that Run instead.
    if (receipt.idempotent) {
        await reconcileRun(input.serverId, ref);
        return receipt;
    }

    try {
        const launch = await provider.start({
            idempotencyKey: receipt.runId,
            instructions,
            ref: receipt.work.startingRef,
            repository: receipt.work.repository,
            title: receipt.work.title,
        });
        report(input.serverId, ref, {
            observedAt: new Date().toISOString(),
            providerAgentId: launch.providerAgentId,
            providerRunId: launch.providerRunId,
            ...(launch.providerUrl ? { providerUrl: launch.providerUrl } : {}),
            status: launch.status,
        });
        watchRun(input.serverId, {
            ...ref,
            providerAgentId: launch.providerAgentId,
            providerRunId: launch.providerRunId,
        });
        return receipt;
    } catch (cause) {
        report(input.serverId, ref, {
            errorCode: 'provider-launch-failed',
            observedAt: new Date().toISOString(),
            status: 'failed',
            summary: cause instanceof Error ? cause.message : String(cause),
        });
        throw new CloudAgentLaunchFailedError(receipt, cause);
    }
}

/** Applies a Server-recorded cancellation and reports the settled Run. */
export async function applyCloudAgentCancel(
    serverId: string,
    command: CloudAgentCancelCommand
): Promise<void> {
    const ref: CloudAgentRunRef = {
        providerAgentId: command.providerAgentId,
        providerRunId: command.providerRunId,
        runId: command.runId,
        workId: command.workId,
    };
    releaseRun(serverId, ref);
    const provider = cloudAgentProvider();
    await provider.cancel(ref);
    report(serverId, ref, await provider.read(ref));
}

/**
 * Reconnect reconciliation. Every non-terminal work this Computer still owns is
 * re-read from the provider and reported, and a cancel recorded while the
 * socket was down is applied first.
 */
export async function reconcileCloudAgentWork(
    serverId: string,
    entries: CloudAgentReconcileEntry[]
): Promise<void> {
    for (const entry of entries) {
        await reconcileRun(
            serverId,
            {
                providerAgentId: entry.providerAgentId,
                providerRunId: entry.providerRunId,
                runId: entry.runId,
                workId: entry.workId,
            },
            entry.cancelRequested
        );
    }
}

/**
 * Reads one Run from the provider and reports what it finds. A provider that
 * cannot be reached reports nothing: the work stays non-terminal with a stale
 * `updatedAt`, which the presentation already accounts for, and the next
 * reconnect tries again. Settling live provider work on a transient read
 * failure would be a lie.
 */
async function reconcileRun(
    serverId: string,
    ref: CloudAgentRunRef,
    cancelRequested = false
): Promise<void> {
    const provider = cloudAgentProvider();
    try {
        if (cancelRequested) {
            await provider.cancel(ref);
        }
        report(serverId, ref, await provider.read(ref));
        watchRun(serverId, ref);
    } catch (error) {
        console.error(
            `Cloud Agent run ${ref.runId} could not be read: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

class CloudAgentServerError extends Error {
    readonly code: string;

    constructor(payload: unknown) {
        const body = (payload ?? {}) as { code?: unknown; message?: unknown };
        super(typeof body.message === 'string' ? body.message : 'The Server refused the launch.');
        this.code = typeof body.code === 'string' ? body.code : 'SERVER_5XX';
        this.name = 'CloudAgentServerError';
    }
}

function watchRun(serverId: string, ref: CloudAgentRunRef): void {
    const key = runKey(serverId, ref);
    if (liveRuns.has(key)) {
        return;
    }
    try {
        liveRuns.set(
            key,
            cloudAgentProvider().subscribe(ref, (observation) => {
                report(serverId, ref, observation);
                if (observation.status !== 'queued' && observation.status !== 'running') {
                    releaseRun(serverId, ref);
                }
            })
        );
    } catch {
        // A provider without a live stream reconciles by read alone.
    }
}

function releaseRun(serverId: string, ref: CloudAgentRunRef): void {
    const key = runKey(serverId, ref);
    liveRuns.get(key)?.();
    liveRuns.delete(key);
}

function runKey(serverId: string, ref: CloudAgentRunRef): string {
    return `${serverId}:${ref.runId}`;
}

function report(
    serverId: string,
    ref: CloudAgentRunRef,
    observation: CloudAgentProviderObservation
): void {
    reporters.get(serverId)?.({ ...observation, runId: ref.runId, workId: ref.workId });
}
