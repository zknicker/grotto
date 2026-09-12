import type { HausDatabase } from '../src/postgres/connection.ts';

/**
 * The Server database with one extra rule: a statement started inside a
 * transaction while another is still in flight fails the test instead of
 * racing Bun's connection pool for the transaction's reserved connection.
 *
 * A transaction holds one reserved connection, so overlapping reads on it
 * strand the transaction idle while it still holds the Server row lock, and
 * every later durable write queues behind a lock nobody releases. Drive a
 * write path through this handle and the fan-out fails loudly instead.
 */
export function serializedTransactions(db: HausDatabase): HausDatabase {
    return new Proxy(db, {
        get: (target, property) =>
            property === 'transaction'
                ? (run: (tx: unknown) => unknown, config?: unknown) =>
                      db.transaction(
                          ((tx: object) => run(oneAtATime(tx, { inFlight: 0 }))) as never,
                          config as never
                      )
                : Reflect.get(target, property),
    });
}

interface StatementCount {
    inFlight: number;
}

function oneAtATime<T extends object>(value: T, state: StatementCount): T {
    return new Proxy(value, {
        get: (target, property) => {
            const member = Reflect.get(target, property);
            if (typeof member !== 'function') {
                return member;
            }
            if (property === 'then') {
                return awaitOne(target, member as ThenLike, state);
            }
            return (...args: unknown[]) => {
                const result = (member as (...rest: unknown[]) => unknown).apply(target, args);
                return result && typeof result === 'object'
                    ? oneAtATime(result as object, state)
                    : result;
            };
        },
    });
}

type ThenLike = (
    onDone?: (value: unknown) => unknown,
    onFail?: (cause: unknown) => unknown
) => unknown;

function awaitOne(target: object, then: ThenLike, state: StatementCount): ThenLike {
    return (onDone, onFail) => {
        if (state.inFlight > 0) {
            throw new Error(
                'A statement overlapped another on the transaction connection; ' +
                    'thread reads through the transaction one at a time.'
            );
        }
        state.inFlight += 1;
        const settle = () => {
            state.inFlight -= 1;
        };
        return then.call(
            target,
            (value: unknown) => {
                settle();
                return onDone?.(value);
            },
            (cause: unknown) => {
                settle();
                return onFail?.(cause);
            }
        );
    };
}
