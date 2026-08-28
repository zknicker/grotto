import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRequiredTargetsSelected, calculateReleaseImpact } from './release-impact.mjs';

const sha = (character) => character.repeat(40);
const ledger = [
    {
        version: '1.8.24',
        date: '2026-08-26',
        targets: {
            server: '1.8.24',
            app: '1.8.24',
            ios: { version: '1.0.4', buildNumber: 5 },
            computer: '1.4.8',
        },
    },
    {
        version: '1.8.25',
        date: '2026-08-27',
        targets: { server: '1.8.25', app: null, ios: null, computer: null },
    },
];

test('pending Computer code remains required after later Server-only releases', async () => {
    const impact = await calculateReleaseImpact({
        ledger,
        candidateRef: sha('f'),
        resolveTag: async (tag) =>
            ({
                'computer-v1.4.8': sha('c'),
                'v1.8.24': sha('a'),
                'v1.8.25': sha('b'),
            })[tag] ?? null,
        listChangedFiles: async (before) =>
            before === sha('c') ? ['apps/computer/src/harness/managed-instructions.ts'] : [],
    });

    assert.equal(impact.targets.computer.baseline.tag, 'computer-v1.4.8');
    assert.equal(impact.targets.computer.status, 'required');
    assert.throws(
        () =>
            assertRequiredTargetsSelected({
                impact,
                selectedTargets: { server: true, app: false, ios: false, computer: false },
            }),
        /apps\/computer\/src\/harness\/managed-instructions\.ts/
    );
});

test('shared contracts request agent review while tests and docs stay unchanged', async () => {
    const impact = await calculateReleaseImpact({
        ledger,
        resolveTag: async (tag) =>
            ({
                'computer-v1.4.8': sha('c'),
                'v1.8.24': sha('a'),
                'v1.8.25': sha('b'),
            })[tag] ?? null,
        listChangedFiles: async () => [
            'packages/grotto-api/src/rich-references.ts',
            'apps/computer/src/harness/managed-instructions.test.ts',
            'docs/operations/releases.md',
        ],
    });

    assert.equal(impact.targets.server.status, 'review');
    assert.equal(impact.targets.app.status, 'review');
    assert.equal(impact.targets.computer.status, 'review');
    assert.equal(impact.targets.ios.status, 'review');
    assert.doesNotThrow(() =>
        assertRequiredTargetsSelected({
            impact,
            selectedTargets: { server: true, app: false, ios: false, computer: false },
        })
    );
});

test('dependency inputs request review from every Node artifact they can affect', async () => {
    const impact = await calculateReleaseImpact({
        ledger,
        resolveTag: async (tag) =>
            ({
                'computer-v1.4.8': sha('c'),
                'v1.8.24': sha('a'),
                'v1.8.25': sha('b'),
            })[tag] ?? null,
        listChangedFiles: async () => ['apps/website/package.json', 'bun.lock'],
    });

    assert.equal(impact.targets.server.status, 'review');
    assert.equal(impact.targets.app.status, 'review');
    assert.equal(impact.targets.computer.status, 'review');
    assert.equal(impact.targets.ios.status, 'unchanged');
});

test('direct shipping paths require their owning targets', async () => {
    const files = [
        'apps/server/src/grotto-server.ts',
        'apps/website/electron/main.cjs',
        'apps/ios-swift/Sources/Grotto/App.swift',
        'packages/agent-workspace/src/starter-kit.ts',
    ];
    const impact = await calculateReleaseImpact({
        ledger,
        resolveTag: async (tag) =>
            ({
                'computer-v1.4.8': sha('c'),
                'v1.8.24': sha('a'),
                'v1.8.25': sha('b'),
            })[tag] ?? null,
        listChangedFiles: async () => files,
    });

    for (const target of ['server', 'app', 'ios', 'computer']) {
        assert.equal(impact.targets[target].status, 'required');
    }
});

test('legacy targets without tags use the last historical release commit, not the candidate', async () => {
    const ledgerWithLegacyReleases = [
        ledger[0],
        {
            version: '1.8.25',
            date: '2026-08-27',
            targets: {
                server: '1.8.25',
                app: null,
                ios: { version: '1.0.5', buildNumber: 6 },
                computer: null,
            },
        },
        {
            version: '1.8.26',
            date: '2026-08-28',
            targets: {
                server: '1.8.26',
                app: null,
                ios: { version: '1.0.6', buildNumber: 7 },
                computer: null,
            },
        },
    ];
    const resolvedVersions = [];
    const impact = await calculateReleaseImpact({
        ledger: ledgerWithLegacyReleases,
        resolveTag: async (tag) =>
            ({
                'computer-v1.4.8': sha('c'),
                'v1.8.24': sha('a'),
            })[tag] ?? null,
        resolveReleaseCommit: async (version) => {
            resolvedVersions.push(version);
            return version === '1.8.25' ? sha('d') : null;
        },
        listChangedFiles: async (before) =>
            before === sha('d') ? ['apps/ios-swift/Sources/Grotto/App.swift'] : [],
    });

    assert.equal(impact.targets.ios.baseline.tag, 'release:v1.8.25');
    assert.equal(impact.targets.ios.status, 'required');
    assert.deepEqual([...new Set(resolvedVersions)], ['1.8.25']);
});
