import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatHeader,
    formatLogLine,
    formatReadyBlock,
    getSnapshotChangeLines,
    snapshotDigest,
} from './dev-stack-log-format.mjs';

function snapshot(overrides = {}) {
    return {
        config: {
            desktopEnabled: true,
            grottoServerUrl: 'http://localhost:8090',
            postgresDataPath: '~/.tavern/dev/test/postgres',
            websiteUrl: 'http://localhost:3100',
        },
        phase: 'starting',
        processes: {
            computer: { status: 'waiting' },
            desktop: { status: 'waiting' },
            grotto: { status: 'waiting' },
            postgres: { status: 'waiting' },
            website: { status: 'waiting' },
        },
        staleCleanupCount: 0,
        ...overrides,
    };
}

test('formats current stack services without standalone Runtime surfaces', () => {
    const output = formatReadyBlock(snapshot(), { colorize: false });
    assert.match(output, /Server\s+http:\/\/localhost:8090/u);
    assert.match(output, /Computer\s+running/u);
    assert.match(output, /Website\s+http:\/\/localhost:3100/u);
    assert.doesNotMatch(output, /Runtime|Local API|Jobs|\.sqlite/u);
});

test('streams Computer startup and emits the final ready block', () => {
    const initial = snapshotDigest(snapshot());
    const runningSnapshot = snapshot({
        phase: 'running',
        processes: {
            computer: { status: 'running' },
            desktop: { status: 'running' },
            grotto: { status: 'running' },
            postgres: { status: 'running' },
            website: { status: 'running' },
        },
    });
    const lines = getSnapshotChangeLines(
        initial,
        snapshotDigest(runningSnapshot),
        runningSnapshot,
        { colorize: false }
    );
    assert.equal(lines.length, 1);
    assert.match(lines[0], /Ready to go/u);
});

test('prefixes Computer logs with the current service name', () => {
    assert.equal(
        formatLogLine({ line: 'runner ready', source: 'computer' }, { colorize: false }),
        '🖥️ computer runner ready'
    );
    assert.match(formatHeader(snapshot(), { colorize: false }), /booting local stack/u);
});
