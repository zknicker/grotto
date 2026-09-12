import type { AgentRuntimeBrowserState, AgentRuntimeBrowserStatus } from '@haus/api';
import { type EffectRuntime, settle } from '@haus/effect';
import { Cause, Chunk, Deferred, Effect, Exit, Fiber, Queue } from 'effect';
import {
    browserFailureLogAnnotations,
    classifyBrowserFailure,
    SupervisorOperations,
    type SupervisorOperationsOptions,
} from './supervisor-operations.ts';

export type BrowserSupervisorStopMode = 'preserve-browser' | 'stop-browser';
type SupervisorVoidRequest = 'restart-browser' | 'sample' | 'start' | 'start-browser';

export interface BrowserSupervisorOptions extends SupervisorOperationsOptions {
    onStatusChanged?: (state: AgentRuntimeBrowserState) => void;
    runtime: EffectRuntime<never>;
}

export class BrowserSupervisorStoppedError extends Error {
    constructor() {
        super('Browser supervision has stopped.');
        this.name = 'BrowserSupervisorStoppedError';
    }
}

type RequestKind = SupervisorVoidRequest | 'status';
type Reply = { kind: 'status'; status: AgentRuntimeBrowserStatus } | { kind: 'void' };
interface Request {
    kind: RequestKind;
    reply: Deferred.Deferred<Reply, Error>;
}

export class BrowserSupervisor {
    private readonly operations: SupervisorOperations;
    private readonly requests: Queue.Queue<Request>;
    private readonly owner: Fiber.RuntimeFiber<never, Error>;
    private readonly runtime: EffectRuntime<never>;
    private accepting = true;
    private current: Request | null = null;
    private monitor: Fiber.RuntimeFiber<never, never> | null = null;
    private monitoring = false;
    private shutdownError: Error | null = null;
    private stopMode: BrowserSupervisorStopMode = 'preserve-browser';
    private stopPromise: Promise<void> | null = null;

    constructor(options: BrowserSupervisorOptions) {
        this.runtime = options.runtime;
        this.operations = new SupervisorOperations(options);
        this.requests = this.runtime.runSync(Queue.unbounded<Request>());
        this.owner = this.runtime.runFork(this.run());
    }

    start(): Promise<void> {
        return this.voidRequest('start');
    }

    startBrowser(): Promise<void> {
        return this.voidRequest('start-browser');
    }

    restartBrowser(): Promise<void> {
        return this.voidRequest('restart-browser');
    }

    sample(): Promise<void> {
        return this.voidRequest('sample');
    }

    private async voidRequest(kind: SupervisorVoidRequest): Promise<void> {
        const reply = await this.submit(kind);
        if (reply.kind !== 'void') {
            throw new Error('Browser supervision returned an invalid command response.');
        }
    }

    async status(): Promise<AgentRuntimeBrowserStatus> {
        const reply = await this.submit('status');
        if (reply.kind !== 'status') {
            throw new Error('Browser supervision returned an invalid status response.');
        }
        return reply.status;
    }

    stop(mode: BrowserSupervisorStopMode = 'preserve-browser'): Promise<void> {
        if (mode === 'stop-browser') {
            this.stopMode = mode;
        }
        if (this.stopPromise) {
            return this.stopPromise;
        }
        this.accepting = false;
        this.stopPromise = this.interruptOwner();
        return this.stopPromise;
    }

    private submit(kind: RequestKind): Promise<Reply> {
        if (!this.accepting) {
            return Promise.reject(new BrowserSupervisorStoppedError());
        }
        const reply = this.runtime.runSync(Deferred.make<Reply, Error>());
        const offered = this.runtime.runSync(Queue.offer(this.requests, { kind, reply }));
        return offered
            ? settle(this.runtime, Deferred.await(reply))
            : Promise.reject(new BrowserSupervisorStoppedError());
    }

    private submitEffect(kind: RequestKind): Effect.Effect<Reply, Error> {
        return Effect.gen(this, function* () {
            if (!this.accepting) {
                return yield* Effect.fail(new BrowserSupervisorStoppedError());
            }
            const reply = yield* Deferred.make<Reply, Error>();
            const offered = yield* Queue.offer(this.requests, { kind, reply });
            if (!offered) {
                return yield* Effect.fail(new BrowserSupervisorStoppedError());
            }
            return yield* Deferred.await(reply);
        });
    }

    private run(): Effect.Effect<never, Error> {
        const finish = this.finish().pipe(
            Effect.catchAll((error) =>
                Effect.sync(() => {
                    this.shutdownError = error;
                })
            )
        );
        return Effect.forever(
            Queue.take(this.requests).pipe(
                Effect.tap((request) =>
                    Effect.sync(() => {
                        this.current = request;
                    })
                ),
                Effect.flatMap((request) => this.handle(request)),
                Effect.tap(() =>
                    Effect.sync(() => {
                        this.current = null;
                    })
                )
            )
        ).pipe(Effect.ensuring(finish));
    }

    private handle(request: Request): Effect.Effect<void, Error> {
        return Effect.matchCauseEffect(this.action(request.kind), {
            onFailure: (cause) =>
                Deferred.failCause(request.reply, cause).pipe(
                    Effect.andThen(
                        Cause.isInterrupted(cause) ? Effect.failCause(cause) : Effect.void
                    )
                ),
            onSuccess: (reply) => Deferred.succeed(request.reply, reply).pipe(Effect.asVoid),
        });
    }

    private action(kind: RequestKind): Effect.Effect<Reply, Error> {
        switch (kind) {
            case 'start':
                return this.startMonitoring().pipe(Effect.as({ kind: 'void' } as const));
            case 'start-browser':
                return this.operations.startBrowser().pipe(Effect.as({ kind: 'void' } as const));
            case 'restart-browser':
                return this.operations.restart('manual').pipe(Effect.as({ kind: 'void' } as const));
            case 'status':
                return this.operations
                    .status()
                    .pipe(Effect.map((status) => ({ kind: 'status' as const, status })));
            case 'sample':
                return this.operations.sample().pipe(Effect.as({ kind: 'void' } as const));
            default: {
                const _exhaustive: never = kind;
                return _exhaustive;
            }
        }
    }

    private startMonitoring(): Effect.Effect<void, never> {
        if (this.monitoring) {
            return Effect.void;
        }
        return Effect.gen(this, function* () {
            this.monitoring = true;
            this.monitor = yield* Effect.fork(this.monitorLoop());
            yield* this.operations
                .startBrowser()
                .pipe(
                    Effect.catchAll((error) =>
                        Effect.logWarning(
                            'Managed Chrome did not start; Browser supervision will continue.'
                        ).pipe(
                            Effect.annotateLogs(
                                browserFailureLogAnnotations(
                                    'browser.start',
                                    classifyBrowserFailure(error)
                                )
                            )
                        )
                    )
                );
        });
    }

    private monitorLoop(): Effect.Effect<never, never> {
        return Effect.forever(
            Effect.sleep(this.operations.sampleIntervalMs).pipe(
                Effect.andThen(this.submitEffect('sample')),
                Effect.asVoid,
                Effect.catchAll((error) =>
                    error instanceof BrowserSupervisorStoppedError
                        ? Effect.interrupt
                        : Effect.logWarning(
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
            )
        );
    }

    private finish(): Effect.Effect<void, Error> {
        return Effect.gen(this, function* () {
            this.accepting = false;
            if (this.monitor) {
                yield* Fiber.interrupt(this.monitor);
            }
            this.monitor = null;
            if (this.current) {
                yield* Deferred.fail(this.current.reply, new BrowserSupervisorStoppedError());
                this.current = null;
            }
            const pending = yield* Queue.takeAll(this.requests);
            yield* Effect.forEach(Chunk.toReadonlyArray(pending), (request) =>
                Deferred.fail(request.reply, new BrowserSupervisorStoppedError())
            );
            yield* Queue.shutdown(this.requests);
            if (this.stopMode === 'stop-browser') {
                yield* this.operations.stopBrowser();
            }
        });
    }

    private async interruptOwner(): Promise<void> {
        const exit = await settle(this.runtime, Fiber.interrupt(this.owner));
        if (this.shutdownError) {
            throw this.shutdownError;
        }
        if (Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause)) {
            await settle(this.runtime, Effect.failCause(exit.cause));
        }
    }
}
