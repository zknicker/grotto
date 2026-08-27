import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyComputerOnlyRelease } from './computer-release-verifier.mjs';
import { APP_RELEASE_ASSETS, verifyNormalRelease } from './github-release-verifier.mjs';
import { projectLedgerValues, validateDetectorPlan, writeReleaseOutputs } from './release-plan.mjs';

const sourceRevision = 'a'.repeat(40);
const plan = (targets = {}, initialLedgerMigration = false) => ({
    initialLedgerMigration,
    targets: { computer: false, app: false, ios: false, server: false, ...targets },
});
const ledger = (targets = {}) => [
    {
        version: '1.2.3',
        targets: {
            server: 'publish',
            app: 'publish',
            computer: '2.3.4',
            ios: { version: '1.2.3', buildNumber: 9 },
            ...targets,
        },
    },
];

test('release plan helpers enforce the detector contract and project ledger values', () => {
    const valid = plan({ server: true });
    assert.equal(validateDetectorPlan(valid), valid);
    for (const invalid of [
        {},
        { ...valid, extra: true },
        { ...valid, initialLedgerMigration: 'false' },
        { ...valid, targets: { ...valid.targets, app: null } },
        { ...valid, targets: { ...valid.targets, extra: false } },
        plan({ computer: true }, true),
    ]) {
        assert.throws(() => validateDetectorPlan(invalid));
    }
    assert.deepEqual(
        projectLedgerValues({
            ledger: ledger(),
            plan: plan({ computer: true, app: true, ios: true, server: true }),
        }),
        {
            releaseVersion: '1.2.3',
            computerVersion: '2.3.4',
            iosVersion: '1.2.3',
            iosBuildNumber: '9',
        }
    );
    assert.deepEqual(
        projectLedgerValues({
            ledger: ledger({ app: null, ios: null }),
            plan: plan({ computer: true }),
        }),
        { releaseVersion: '', computerVersion: '2.3.4', iosVersion: '', iosBuildNumber: '' }
    );
    assert.deepEqual(projectLedgerValues({ ledger: [{ targets: {} }], plan: plan({}, true) }), {
        releaseVersion: '',
        computerVersion: '',
        iosVersion: '',
        iosBuildNumber: '',
    });
    assert.throws(
        () =>
            projectLedgerValues({
                ledger: ledger({ computer: 'undecided' }),
                plan: plan({ computer: true }),
            }),
        /undecided/
    );
    assert.throws(
        () =>
            projectLedgerValues({
                ledger: ledger({ server: false }),
                plan: plan({ server: true }),
            }),
        /invalid/
    );
    assert.throws(
        () =>
            projectLedgerValues({
                ledger: ledger({ ios: { version: '1.2.3', buildNumber: 0 } }),
                plan: plan({ ios: true, server: true }),
            }),
        /positive integer/
    );
    assert.throws(
        () => projectLedgerValues({ ledger: ledger(), plan: plan({ app: true }) }),
        /requires a Server/
    );
    assert.throws(
        () => projectLedgerValues({ ledger: ledger(), plan: plan({ computer: true, app: true }) }),
        /Computer-only/
    );
});

test('release plan output preserves raw detector JSON and projected outputs', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'grotto-plan-test-'));
    try {
        const outputPath = path.join(directory, 'output');
        const summaryPath = path.join(directory, 'summary');
        const rawPlan =
            '{"initialLedgerMigration":false,"targets":{"computer":false,"app":false,"ios":false,"server":true}}\n';
        writeReleaseOutputs({
            rawPlan,
            plan: plan({ server: true }),
            values: {
                releaseVersion: '1.2.3',
                computerVersion: '',
                iosVersion: '',
                iosBuildNumber: '',
            },
            outputPath,
            summaryPath,
        });
        const output = readFileSync(outputPath, 'utf8');
        assert.match(output, /plan<<grotto_release_plan_/);
        assert.match(output, /initial_ledger_migration=false/);
        assert.match(output, /publish_server=true/);
        assert.match(output, /release_version=1\.2\.3/);
    } finally {
        rmSync(directory, { force: true, recursive: true });
    }
});

function releaseApi(release, tagType = 'tag') {
    const tagObject = 'b'.repeat(40);
    const values = new Map([
        [
            'repos/zknicker/grotto/git/ref/tags/v1.2.3',
            { object: { type: tagType, sha: tagType === 'tag' ? tagObject : sourceRevision } },
        ],
        [
            `repos/zknicker/grotto/git/tags/${tagObject}`,
            { object: { type: 'commit', sha: sourceRevision } },
        ],
        ['repos/zknicker/grotto/releases/tags/v1.2.3', release],
    ]);
    return async (endpoint) => {
        if (!values.has(endpoint)) {
            throw new Error(`unexpected GitHub API endpoint ${endpoint}`);
        }
        return values.get(endpoint);
    };
}

test('GitHub and Computer finalizers verify tags, assets, and descriptors', async () => {
    const required = [
        `grotto-server-1.2.3+git.${sourceRevision.slice(0, 12)}-aarch64-apple-darwin.tar.gz`,
        'grotto-server-1.2.3+git.' +
            sourceRevision.slice(0, 12) +
            '-aarch64-apple-darwin.tar.gz.sha256',
        ...APP_RELEASE_ASSETS.map((name) => name.replace('{version}', '1.2.3')),
    ];
    const release = {
        draft: false,
        prerelease: false,
        published_at: 'now',
        assets: required.map((name) => ({ name })),
    };
    const normal = await verifyNormalRelease({
        repository: 'zknicker/grotto',
        sourceRevision,
        releaseVersion: '1.2.3',
        publishApp: true,
        ghApi: releaseApi(release),
    });
    assert.equal(normal.mode, 'normal');
    assert.deepEqual(normal.requiredAssets, required);
    await assert.rejects(
        () =>
            verifyNormalRelease({
                repository: 'zknicker/grotto',
                sourceRevision: 'c'.repeat(40),
                releaseVersion: '1.2.3',
                publishApp: false,
                ghApi: releaseApi(release),
            }),
        /expected merged SHA/
    );
    await assert.rejects(
        () =>
            verifyNormalRelease({
                repository: 'zknicker/grotto',
                sourceRevision,
                releaseVersion: '1.2.3',
                publishApp: false,
                ghApi: releaseApi({ ...release, draft: true }),
            }),
        /missing a published release/
    );
    await assert.rejects(
        () =>
            verifyNormalRelease({
                repository: 'zknicker/grotto',
                sourceRevision,
                releaseVersion: '1.2.3',
                publishApp: false,
                ghApi: releaseApi({ ...release, assets: [{ name: 'unrelated' }] }),
            }),
        /missing asset/
    );

    let requestedUrl;
    const computer = await verifyComputerOnlyRelease({
        repository: 'zknicker/grotto',
        sourceRevision,
        computerVersion: '1.2.3',
        ghApi: async (endpoint) => {
            assert.equal(endpoint, 'repos/zknicker/grotto/git/ref/tags/computer-v1.2.3');
            return { object: { type: 'commit', sha: sourceRevision } };
        },
        fetchImpl: async (url, options) => {
            requestedUrl = url;
            assert.deepEqual(options, { cache: 'no-store' });
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    release: { version: '1.2.3', sourceRevision },
                    signature: 'signature',
                }),
            };
        },
    });
    assert.equal(computer.mode, 'computer-only');
    assert.equal(requestedUrl, 'https://releases.grotto.sh/computer/1.2.3/release.json');
});
