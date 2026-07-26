import { expect, test } from 'bun:test';
import { connectGrottoDatabase } from '../src/postgres/connection.ts';

const secret = 'sup3rsecret';
const unreachableDatabaseUrl = `postgres://grotto:${secret}@127.0.0.1:1/grotto`;

test('keeps PostgreSQL credentials out of connection failures', async () => {
    let reported: unknown;

    try {
        await connectGrottoDatabase(unreachableDatabaseUrl);
    } catch (error) {
        reported = error;
    }

    expect(reported).toBeInstanceOf(Error);
    expect(describeError(reported as Error)).not.toContain(secret);
    expect(describeError(reported as Error)).toContain('127.0.0.1:1');
});

function describeError(error: Error): string {
    const parts: string[] = [];

    for (let cause: unknown = error; cause instanceof Error; cause = cause.cause) {
        parts.push(cause.message, cause.stack ?? '');
    }

    return parts.join('\n');
}
