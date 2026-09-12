import type { AgentRuntimeBrowserState, AgentRuntimeBrowserStatus } from '@haus/api';
import { Clock, Data, Effect, Option } from 'effect';
import type { BrowserCommandQueue } from './command-queue.ts';
import {
    appendRecoveryEvidence,
    type BrowserSupervisorPolicy,
    defaultBrowserSupervisorPolicy,
    evaluateBrowserHealth,
    initialSupervisionEvidence,
    pruneAutomaticRestarts,
    type SupervisionEvidence,
} from './supervisor-policy.ts';
import type { BrowserLifecycleControl, BrowserObservation } from './types.ts';
import { stoppedBrowserObservation } from './types.ts';

export interface SupervisorOperationsOptions {
    browserVersion: string | null;
    commandQueue: BrowserCommandQueue;
    lifecycle: BrowserLifecycleControl;
    onStatusChanged?: (state: AgentRuntimeBrowserState) => void;
    policy?: Partial<BrowserSupervisorPolicy>;
}

export type BrowserLogFailureKind =
    | 'aborted'
    | 'busy'
    | 'external'
    | 'unavailable'
    | 'unknown'
    | 'unresponsive';

class BrowserStatusListenerError extends Data.TaggedError('BrowserStatusListenerError')<{
    readonly cause: unknown;
}> {}

export function browserFailureLogAnnotations(
    operation: `browser.${'detect' | 'recovery' | 'sample' | 'start' | 'status-publish'}`,
    failureKind: BrowserLogFailureKind
) {
    return { failureKind, operation } as const;
}

export function classifyBrowserFailure(cause: unknown): BrowserLogFailureKind {
    if (cause instanceof Error && cause.name === 'AbortError') {
        return 'aborted';
    }
    return cause instanceof Error ? 'external' : 'unknown';
}

export class SupervisorOperations {
    readonly sampleIntervalMs: number;
    private readonly policy: BrowserSupervisorPolicy;
    private evidence: SupervisionEvidence = initialSupervisionEvidence();

    constructor(private readonly options: SupervisorOperationsOptions) {
        this.policy = { ...defaultBrowserSupervisorPolicy, ...options.policy };
        this.sampleIntervalMs = this.policy.sampleIntervalMs;
    }

    startBrowser(): Effect.Effect<void, Error> {
        return Effect.gen(this, function* () {
            yield* lifecycle(() => this.options.lifecycle.start());
            this.evidence = {
                ...this.evidence,
                cdpFailureSince: null,
                recoveryFailure: null,
            };
            yield* this.status();
        });
    }

    restart(mode: 'automatic' | 'manual'): Effect.Effect<void, Error> {
        return Effect.gen(this, function* () {
            const drained = yield* this.waitForDrain();
            if (!(drained || mode === 'manual')) {
                yield* Effect.logWarning(
                    'Browser recovery was deferred because a command is running.'
                ).pipe(
                    Effect.annotateLogs(browserFailureLogAnnotations('browser.recovery', 'busy'))
                );
                return;
            }
            const now = yield* Clock.currentTimeMillis;
            const pruned = pruneAutomaticRestarts({
                evidence: this.evidence,
                now,
                policy: this.policy,
            });
            if (mode === 'automatic' && pruned.length >= this.policy.restartBudgetLimit) {
                return;
            }
            this.evidence = {
                ...this.evidence,
                automaticRestarts: mode === 'automatic' ? [...pruned, now] : pruned,
            };
            yield* this.publish('recovering');
            if (mode === 'automatic') {
                yield* this.captureEvidence();
                yield* Effect.logWarning('Browser automatic recovery is starting.').pipe(
                    Effect.annotateLogs(
                        browserFailureLogAnnotations('browser.recovery', 'unresponsive')
                    )
                );
            }
            const attempt = lifecycle(() => this.options.lifecycle.restart()).pipe(
                Effect.andThen(this.verifyRestart())
            );
            if (mode === 'manual') {
                yield* attempt;
            } else {
                const result = yield* Effect.either(attempt);
                yield* this.completeAutomaticRecovery(result._tag === 'Left' ? result.left : null);
            }
            yield* this.status();
        });
    }

    sample(): Effect.Effect<void, never> {
        return this.status().pipe(
            Effect.flatMap((status) =>
                status.state === 'unresponsive'
                    ? this.restart('automatic').pipe(Effect.catchAll(() => Effect.void))
                    : Effect.void
            ),
            Effect.catchAll((error) =>
                Effect.logWarning(
                    'Browser supervision sample failed; the next sample will retry.'
                ).pipe(
                    Effect.annotateLogs(
                        browserFailureLogAnnotations(
                            'browser.sample',
                            classifyBrowserFailure(error)
                        )
                    )
                )
            )
        );
    }

    status(): Effect.Effect<AgentRuntimeBrowserStatus, never> {
        return Effect.gen(this, function* () {
            const now = yield* Clock.currentTimeMillis;
            const observed = yield* lifecycle(() => this.options.lifecycle.observe()).pipe(
                Effect.either
            );
            const observation =
                observed._tag === 'Right' ? observed.right : stoppedBrowserObservation;
            const evaluation =
                observed._tag === 'Right'
                    ? evaluateBrowserHealth({
                          evidence: this.evidence,
                          now,
                          observation,
                          policy: this.policy,
                      })
                    : {
                          evidence: {
                              ...this.evidence,
                              automaticRestarts: pruneAutomaticRestarts({
                                  evidence: this.evidence,
                                  now,
                                  policy: this.policy,
                              }),
                          },
                          reason: `Browser observation failed: ${observed.left.message}`,
                          state: 'degraded' as const,
                      };
            this.evidence = evaluation.evidence;
            yield* this.publish(evaluation.state);
            return this.statusValue(observation, evaluation.reason, evaluation.state, now);
        });
    }

    stopBrowser(): Effect.Effect<void, Error> {
        return lifecycle(() => this.options.lifecycle.stop());
    }

    private statusValue(
        observation: BrowserObservation,
        reason: string | null,
        state: AgentRuntimeBrowserState,
        now: number
    ): AgentRuntimeBrowserStatus {
        return {
            browserVersion: this.options.browserVersion,
            cdpState: observation.cdp.state,
            checkedAt: new Date(now).toISOString(),
            pid: observation.pid,
            pressureSince: this.evidence.pressureSince
                ? new Date(this.evidence.pressureSince).toISOString()
                : null,
            reason,
            resources: observation.resources,
            restartBudget: {
                automaticRestartLimit: this.policy.restartBudgetLimit,
                automaticRestartsInWindow: this.evidence.automaticRestarts.length,
            },
            running: observation.running,
            state,
            uptimeSeconds: observation.uptimeSeconds,
        };
    }

    private waitForDrain(): Effect.Effect<boolean, Error> {
        return Effect.tryPromise({
            catch: asError,
            try: (signal) => this.options.commandQueue.waitForDrain(signal),
        }).pipe(Effect.timeoutOption(this.policy.commandDrainTimeoutMs), Effect.map(Option.isSome));
    }

    private captureEvidence(): Effect.Effect<void, never> {
        return Effect.gen(this, function* () {
            const observation = yield* lifecycle(() => this.options.lifecycle.observe());
            const at = yield* Clock.currentTimeMillis;
            this.evidence = {
                ...this.evidence,
                recoveryEvidence: appendRecoveryEvidence(this.evidence.recoveryEvidence, {
                    at,
                    observation,
                    reason: 'Chrome is alive but CDP has remained unreachable.',
                }),
            };
        }).pipe(
            Effect.catchAll(() => Effect.void),
            Effect.asVoid
        );
    }

    private verifyRestart(): Effect.Effect<void, Error> {
        return lifecycle(() => this.options.lifecycle.observe()).pipe(
            Effect.flatMap((observation) =>
                observation.running &&
                observation.contractCompatible &&
                observation.lockHeld &&
                observation.cdp.state === 'healthy'
                    ? Effect.void
                    : Effect.fail(
                          new Error('Chrome restarted but failed profile/CDP verification.')
                      )
            )
        );
    }

    private completeAutomaticRecovery(error: Error | null): Effect.Effect<void, never> {
        this.evidence = error
            ? {
                  ...this.evidence,
                  recoveryFailure: `Browser recovery failed: ${error.message}`,
              }
            : { ...this.evidence, cdpFailureSince: null, recoveryFailure: null };
        if (error) {
            return Effect.logError(
                'Browser automatic recovery failed; supervision will continue.'
            ).pipe(
                Effect.annotateLogs(
                    browserFailureLogAnnotations('browser.recovery', classifyBrowserFailure(error))
                )
            );
        }
        return Effect.logInfo('Browser automatic recovery succeeded.').pipe(
            Effect.annotateLogs({ operation: 'browser.recovery' })
        );
    }

    private publish(state: AgentRuntimeBrowserState): Effect.Effect<void, never> {
        if (this.evidence.lastPublishedState === state) {
            return Effect.void;
        }
        this.evidence = { ...this.evidence, lastPublishedState: state };
        return Effect.try({
            catch: (cause) => new BrowserStatusListenerError({ cause }),
            try: () => this.options.onStatusChanged?.(state),
        }).pipe(
            Effect.catchTag('BrowserStatusListenerError', (error) =>
                Effect.logWarning(
                    'Browser status publication failed; supervision will continue.'
                ).pipe(
                    Effect.annotateLogs(
                        browserFailureLogAnnotations(
                            'browser.status-publish',
                            classifyBrowserFailure(error.cause)
                        )
                    )
                )
            ),
            Effect.asVoid
        );
    }
}

function lifecycle<A>(run: () => Promise<A>): Effect.Effect<A, Error> {
    return Effect.uninterruptible(Effect.tryPromise({ catch: asError, try: run }));
}

function asError(cause: unknown): Error {
    return cause instanceof Error ? cause : new Error(String(cause));
}
