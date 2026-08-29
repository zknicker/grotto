import assert from 'node:assert/strict';
import test from 'node:test';
import {
    grottoSnapshotKeys,
    publishGrottoSnapshotInOrder,
    verifyPublicGrottoSnapshot,
} from './publish-grotto-snapshot.mjs';

test('publishes and verifies the immutable snapshot before moving latest', async () => {
    const calls = [];
    let immutable = null;
    let latest = null;
    await publishGrottoSnapshotInOrder(
        {
            promoteLatest: async () => {
                calls.push('promote latest');
                latest = immutable;
            },
            publishImmutable: async () => {
                calls.push('publish immutable');
                immutable = 'snapshot';
            },
            readImmutable: async () => {
                calls.push('read immutable');
                return immutable;
            },
            readLatest: async () => {
                calls.push('read latest');
                return latest;
            },
        },
        'snapshot'
    );
    assert.deepEqual(calls, [
        'read immutable',
        'publish immutable',
        'read immutable',
        'promote latest',
        'read latest',
    ]);
});

test('reuses matching immutable bytes and rejects a conflicting retry', async () => {
    let publishes = 0;
    const operations = {
        promoteLatest: async () => undefined,
        publishImmutable: async () => {
            publishes += 1;
        },
        readImmutable: async () => 'snapshot',
        readLatest: async () => 'snapshot',
    };
    await publishGrottoSnapshotInOrder(operations, 'snapshot');
    assert.equal(publishes, 0);
    await assert.rejects(
        () => publishGrottoSnapshotInOrder(operations, 'different'),
        /different bytes/
    );
});

test('uses stable versioned and latest release keys', () => {
    assert.deepEqual(grottoSnapshotKeys('1.9.0'), {
        immutable: 'grotto/1.9.0.json',
        latest: 'grotto/latest.json',
    });
});

test('retries until the public snapshot matches exactly', async () => {
    const responses = [new Error('temporary network error'), 'stale', 'snapshot'];
    let delays = 0;

    await verifyPublicGrottoSnapshot(
        () => {
            const response = responses.shift();
            if (response instanceof Error) {
                throw response;
            }
            return response;
        },
        'snapshot',
        {
            attempts: 3,
            delay: () => {
                delays += 1;
            },
        }
    );

    assert.equal(delays, 2);
});

test('rejects a public snapshot that never matches', async () => {
    await assert.rejects(
        () =>
            verifyPublicGrottoSnapshot(() => 'stale', 'snapshot', {
                attempts: 2,
                delay: () => undefined,
            }),
        /public Grotto release snapshot did not verify byte-for-byte/
    );
});
