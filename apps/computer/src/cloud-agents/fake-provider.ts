import type { CloudAgentStatus } from '@grotto/api';
import type {
    CloudAgentLaunch,
    CloudAgentProvider,
    CloudAgentProviderObservation,
    CloudAgentReadiness,
    CloudAgentRunRef,
    CloudAgentStartInput,
} from './provider.ts';

export interface FakeCloudAgentProvider extends CloudAgentProvider {
    /** Pushes the next scripted transition to every live subscriber. */
    advance(): CloudAgentProviderObservation | null;
    failNextStart(message: string): void;
    /** Every launch this provider was asked for, newest last. */
    readonly launches: CloudAgentStartInput[];
}

export interface FakeCloudAgentProviderOptions {
    readiness?: CloudAgentReadiness;
    /** Scripted transitions, replayed in order by `advance`. */
    transitions?: CloudAgentProviderObservation[];
}

/**
 * An in-memory Cloud Agent provider with scripted transitions. It makes the
 * whole path — launch, live observation, reconciliation read, cancellation —
 * testable without a provider account.
 */
export function createFakeCloudAgentProvider(
    options: FakeCloudAgentProviderOptions = {}
): FakeCloudAgentProvider {
    const launches: CloudAgentStartInput[] = [];
    const subscribers = new Set<(observation: CloudAgentProviderObservation) => void>();
    const transitions = [...(options.transitions ?? [])];
    let startFailure: string | null = null;
    let latest: CloudAgentProviderObservation = {
        observedAt: new Date(0).toISOString(),
        status: 'queued',
    };

    return {
        advance() {
            const next = transitions.shift();
            if (!next) {
                return null;
            }
            latest = next;
            for (const subscriber of subscribers) {
                subscriber(next);
            }
            return next;
        },
        cancel(_ref: CloudAgentRunRef) {
            latest = observe('cancelled', 'CANCELLED');
            return Promise.resolve();
        },
        failNextStart(message: string) {
            startFailure = message;
        },
        launches,
        provider: 'cursor',
        read(_ref: CloudAgentRunRef) {
            return Promise.resolve(latest);
        },
        readiness() {
            return Promise.resolve(options.readiness ?? { ready: true });
        },
        start(input: CloudAgentStartInput): Promise<CloudAgentLaunch> {
            if (startFailure) {
                const message = startFailure;
                startFailure = null;
                return Promise.reject(new Error(message));
            }
            launches.push(input);
            latest = {
                ...observe('running', 'RUNNING'),
                providerRunId: `run_${input.idempotencyKey}`,
            };
            return Promise.resolve({
                providerAgentId: `bc_${input.idempotencyKey}`,
                providerRunId: `run_${input.idempotencyKey}`,
                providerUrl: `https://cursor.com/agents/bc_${input.idempotencyKey}`,
                status: 'running',
            });
        },
        subscribe(_ref, onObservation) {
            subscribers.add(onObservation);
            return () => subscribers.delete(onObservation);
        },
    };
}

function observe(status: CloudAgentStatus, rawStatus: string): CloudAgentProviderObservation {
    return { observedAt: new Date().toISOString(), rawStatus, status };
}
