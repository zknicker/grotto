import { Cause, type Effect, Exit, type ManagedRuntime, Runtime } from 'effect';

export type EffectRuntime<R> = ManagedRuntime.ManagedRuntime<R, never>;

export interface SettleOptions<A, E> {
    /** Translate an expected failure only after settlement proves no defect is present. */
    readonly mapFailure?: (failure: E) => unknown;
    /** An interruption-only exit becomes a value when this callback is provided. */
    readonly onInterrupted?: () => A;
    readonly signal?: AbortSignal;
}

/** Convert an unknown foreign failure into the Error shape used at Promise seams. */
export function asError(cause: unknown): Error {
    return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * Settle an Effect at a Promise seam. Expected failures retain identity;
 * defects retain their complete Cause; interruption is explicit.
 */
export async function settle<A, E, R>(
    runtime: EffectRuntime<R>,
    effect: Effect.Effect<A, E, R>,
    options: SettleOptions<A, E> = {}
): Promise<A> {
    const exit = await runtime.runPromiseExit(
        effect,
        options.signal === undefined ? undefined : { signal: options.signal }
    );

    if (Exit.isSuccess(exit)) {
        return exit.value;
    }

    if (Cause.isFailType(exit.cause)) {
        throw options.mapFailure ? options.mapFailure(exit.cause.error) : exit.cause.error;
    }

    if (Cause.isInterruptedOnly(exit.cause) && options.onInterrupted) {
        return options.onInterrupted();
    }

    throw Runtime.makeFiberFailure(exit.cause);
}
