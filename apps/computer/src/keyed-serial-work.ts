import { type EffectRuntime, settle } from '@grotto/effect';
import { Data, Effect, Exit, Fiber, Scope } from 'effect';

class KeyedSerialOperationError extends Data.TaggedError('KeyedSerialOperationError')<{
    readonly cause: unknown;
}> {}

interface KeyedSemaphore {
    readonly semaphore: Effect.Semaphore;
    users: number;
}

/** Runtime-owned mutual exclusion for independent keyed foreign operations. */
export class KeyedSerialWork<R> {
    private closePromise: Promise<void> | null = null;
    private readonly entries = new Map<string, KeyedSemaphore>();
    private readonly scope: Scope.CloseableScope;

    constructor(private readonly runtime: EffectRuntime<R>) {
        this.scope = runtime.runSync(Scope.make());
    }

    close(): Promise<void> {
        this.closePromise ??= settle(
            this.runtime,
            Scope.close(this.scope, Exit.succeed(undefined))
        );
        return this.closePromise;
    }

    run<Value>(key: string, operation: (signal: AbortSignal) => Promise<Value>): Promise<Value> {
        const entry = this.acquire(key);
        const effect = entry.semaphore
            .withPermits(1)(
                Effect.tryPromise({
                    catch: (cause) => new KeyedSerialOperationError({ cause }),
                    try: operation,
                })
            )
            .pipe(Effect.ensuring(this.release(key, entry)));
        return this.runScoped(effect);
    }

    wait(key: string): Promise<void> {
        const entry = this.acquire(key);
        return this.runScoped(
            entry.semaphore
                .withPermits(1)(Effect.void)
                .pipe(Effect.ensuring(this.release(key, entry)))
        );
    }

    private acquire(key: string): KeyedSemaphore {
        const current = this.entries.get(key);
        if (current) {
            current.users += 1;
            return current;
        }
        const created = {
            semaphore: this.runtime.runSync(Effect.makeSemaphore(1)),
            users: 1,
        };
        this.entries.set(key, created);
        return created;
    }

    private release(key: string, entry: KeyedSemaphore): Effect.Effect<void> {
        return Effect.sync(() => {
            entry.users -= 1;
            if (entry.users === 0 && this.entries.get(key) === entry) {
                this.entries.delete(key);
            }
        });
    }

    private runScoped<Value, Failure>(effect: Effect.Effect<Value, Failure, R>): Promise<Value> {
        const fiber = this.runtime.runSync(Effect.forkIn(effect, this.scope));
        const result = settle(this.runtime, Fiber.join(fiber)).catch((cause) => {
            if (cause instanceof KeyedSerialOperationError) {
                throw originalKeyedSerialFailure(cause);
            }
            throw cause;
        });
        void result.then(undefined, () => undefined);
        return result;
    }
}

function originalKeyedSerialFailure(error: KeyedSerialOperationError): unknown {
    return error.cause;
}
