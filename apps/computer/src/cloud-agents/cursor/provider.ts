import {
    type CloudAgentLaunch,
    type CloudAgentProvider,
    type CloudAgentProviderObservation,
    CloudAgentProviderUnavailableError,
    type CloudAgentReadiness,
    type CloudAgentRunRef,
    type CloudAgentStartInput,
} from '../provider.ts';
import { activityOf, cloudAgentStatusOf, cursorAgentUrl, observationOf } from './status.ts';
import {
    type CursorRunAddress,
    type CursorRunStatus,
    type CursorTransport,
    CursorTransportUnavailableError,
    isTerminalCursorRunStatus,
} from './transport.ts';

/**
 * Computer-local access to Cursor's Cloud Agents, behind `CloudAgentProvider`.
 * Every Cursor request, response, and status string is confined to this
 * adapter and its transport; Grotto's durable contracts see only bounded
 * observations. The user API key is never logged, stored by Grotto, or copied
 * to Server — it lives only in Cursor's own credential store.
 */
export function createCursorCloudAgentProvider(
    transport: CursorTransport,
    options: CursorReconcilePolicy = {}
): CloudAgentProvider {
    const policy = {
        backoffMs: options.backoffMs ?? defaultReconcileBackoffMs,
        intervalMs: options.intervalMs ?? defaultReconcileIntervalMs,
    };
    return {
        async cancel(ref: CloudAgentRunRef): Promise<void> {
            await transport.cancelRun(requireAddress(ref));
        },
        async connect(options: { onLoginUrl?: (url: string) => void } = {}) {
            return readinessOf(
                await run(() =>
                    transport.login(options.onLoginUrl ? { onLoginUrl: options.onLoginUrl } : {})
                )
            );
        },
        async disconnect() {
            await run(() => transport.logout());
            return { ready: false as const, reason: 'not-connected' as const };
        },
        provider: 'cursor',
        async read(ref: CloudAgentRunRef): Promise<CloudAgentProviderObservation> {
            const address = requireAddress(ref);
            return observationOf(await transport.readRun(address), {
                agentId: address.agentId,
                observedAt: new Date().toISOString(),
            });
        },
        async readiness(): Promise<CloudAgentReadiness> {
            // Readiness answers rather than throws: an inventory report says
            // truthfully that the provider is unreachable, and a launch fails
            // on that reason before any Message exists.
            try {
                return readinessOf(await transport.authStatus());
            } catch (error) {
                if (error instanceof CursorTransportUnavailableError) {
                    return { ready: false, reason: 'provider-unavailable' };
                }
                throw error;
            }
        },
        async start(input: CloudAgentStartInput): Promise<CloudAgentLaunch> {
            const launch = await transport.start({
                idempotencyKey: input.idempotencyKey,
                instructions: input.instructions,
                ref: input.ref,
                repository: input.repository,
                title: input.title,
            });
            return {
                providerAgentId: launch.agentId,
                providerRunId: launch.reading.runId,
                providerUrl: cursorAgentUrl(launch.agentId),
                status: cloudAgentStatusOf(launch.reading.rawStatus),
            };
        },
        subscribe(
            ref: CloudAgentRunRef,
            onObservation: (observation: CloudAgentProviderObservation) => void
        ): () => void {
            return watchCursorRun(transport, requireAddress(ref), onObservation, policy);
        },
    };
}

/** A Run read every 5 seconds, but only while no stream is attached. */
const defaultReconcileIntervalMs = 5000;
/** After a provider failure, back off rather than hammering an unhappy API. */
const defaultReconcileBackoffMs = 60_000;

/** Only tests narrow these; production runs the spec's own cadence. */
export interface CursorReconcilePolicy {
    backoffMs?: number;
    intervalMs?: number;
}

/**
 * The live edge for one Run. The stream carries progress and Cursor's own raw
 * status; reading the Run is what settles it. Those are deliberately separate:
 * the SDK's stream handle ends on its own client-side wait deadline while the
 * hosted Run keeps working, so trusting the end of a stream would settle live
 * work as failed. When the stream detaches, reconciliation reads the Run until
 * it is genuinely terminal, and stops there.
 */
function watchCursorRun(
    transport: CursorTransport,
    address: CursorRunAddress,
    onObservation: (observation: CloudAgentProviderObservation) => void,
    policy: { backoffMs: number; intervalMs: number }
): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let detachStream: (() => void) | null = null;

    const stop = () => {
        stopped = true;
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        detachStream?.();
        detachStream = null;
    };

    const reconcile = (delayMs: number) => {
        if (stopped || timer) {
            return;
        }
        timer = setTimeout(async () => {
            timer = null;
            if (stopped) {
                return;
            }
            try {
                const reading = await transport.readRun(address);
                if (stopped) {
                    return;
                }
                onObservation(
                    observationOf(reading, {
                        agentId: address.agentId,
                        observedAt: new Date().toISOString(),
                    })
                );
                if (isTerminalCursorRunStatus(reading.rawStatus)) {
                    stop();
                    return;
                }
                reconcile(policy.intervalMs);
            } catch {
                reconcile(policy.backoffMs);
            }
        }, delayMs);
    };

    detachStream = transport.streamRun(address, (event) => {
        if (stopped) {
            return;
        }
        const observedAt = new Date().toISOString();
        if (event.kind === 'detached') {
            detachStream = null;
            reconcile(0);
            return;
        }
        if (event.kind === 'status') {
            // A streamed terminal status is the one place Cursor's raw
            // `EXPIRED` survives, so it settles the Run — but the Run's
            // evidence comes from a read, and the settling observation must
            // carry both. Reporting the bare status first would settle the
            // work, and the caller unsubscribes on settlement, so the evidence
            // read would never be reported.
            if (isTerminalCursorRunStatus(event.rawStatus)) {
                void settle(event.rawStatus);
                return;
            }
            onObservation({
                observedAt,
                providerAgentId: address.agentId,
                providerRunId: address.runId,
                rawStatus: event.rawStatus,
                status: cloudAgentStatusOf(event.rawStatus),
            });
            return;
        }
        const activity = activityOf(event.summary, observedAt);
        if (activity) {
            onObservation({
                activity,
                observedAt,
                providerAgentId: address.agentId,
                providerRunId: address.runId,
                status: 'running',
            });
        }
    });

    return stop;

    /**
     * One settling observation carrying the stream's raw status and the Run's
     * own evidence. A read that fails still settles the work from the streamed
     * status alone: losing the summary is a smaller lie than leaving terminal
     * work running forever.
     */
    async function settle(rawStatus: CursorRunStatus): Promise<void> {
        const reading = await transport.readRun(address).catch(() => null);
        if (stopped) {
            return;
        }
        const observedAt = new Date().toISOString();
        onObservation(
            reading
                ? observationOf({ ...reading, rawStatus }, { agentId: address.agentId, observedAt })
                : {
                      observedAt,
                      providerAgentId: address.agentId,
                      providerRunId: address.runId,
                      rawStatus,
                      status: cloudAgentStatusOf(rawStatus),
                  }
        );
        stop();
    }
}

/**
 * A Run Grotto tracks but Cursor never hosted has no provider address. Failing
 * here keeps a launch that never reached Cursor from reporting a settled Run.
 */
function requireAddress(ref: CloudAgentRunRef): CursorRunAddress {
    if (!(ref.providerAgentId && ref.providerRunId)) {
        throw new CloudAgentProviderUnavailableError('not-connected');
    }
    return { agentId: ref.providerAgentId, runId: ref.providerRunId };
}

function readinessOf(
    auth: Awaited<ReturnType<CursorTransport['authStatus']>>
): CloudAgentReadiness {
    return auth.connected
        ? { account: { email: auth.email, expiresAt: auth.expiresAt }, ready: true }
        : { ready: false, reason: auth.reason };
}

/**
 * An SDK that cannot load at all is a different fact from a missing
 * credential, and only that one degrades the whole capability.
 */
async function run<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (error instanceof CursorTransportUnavailableError) {
            throw new CloudAgentProviderUnavailableError('provider-unavailable');
        }
        throw error;
    }
}
