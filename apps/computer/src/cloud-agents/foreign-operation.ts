import { Data, Effect } from 'effect';

export class CloudAgentOperationError extends Data.TaggedError('CloudAgentOperationError')<{
    readonly cause: unknown;
}> {}

/** Interruption aborts the foreign operation and joins its cleanup before returning. */
export function foreign<Value>(operation: (signal: AbortSignal) => Promise<Value>) {
    return Effect.async<Value, CloudAgentOperationError>((resume, signal) => {
        const pending = Promise.resolve()
            .then(() => operation(signal))
            .then(
                (value) => resume(Effect.succeed(value)),
                (cause) => resume(Effect.fail(new CloudAgentOperationError({ cause })))
            );
        return Effect.promise(() => pending);
    });
}
