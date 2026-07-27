import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
    mkdirSync,
    mkdtempSync,
    readlinkSync,
    rmSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    activateGrottoRelease,
    assertPrivilegedActivationHelper,
    waitForRestartedServerHealth,
} from '../src/grotto-server-activation.ts';

const previousRevision = '1111111111111111111111111111111111111111';
const nextRevision = '2222222222222222222222222222222222222222';

test('atomically activates one verified release and restarts only the Server', async () => {
    const root = mkdtempSync(join(tmpdir(), 'grotto-activation-'));
    const previous = makeRelease(root, previousRevision, 'previous');
    const next = makeRelease(root, nextRevision, 'next');
    symlinkSync(previous, join(root, 'current'));
    let restarts = 0;

    try {
        await activateGrottoRelease({
            deployRoot: root,
            restartServer: () => {
                restarts += 1;
                return '101';
            },
            serverHealthy: (previousPid) => Promise.resolve(previousPid === '101'),
            sourceRevision: nextRevision,
        });

        expect(readlinkSync(join(root, 'current'))).toBe(next);
        expect(restarts).toBe(1);
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
});

test('restores and restarts the previous release when local health fails', async () => {
    const root = mkdtempSync(join(tmpdir(), 'grotto-rollback-'));
    const previous = makeRelease(root, previousRevision, 'previous');
    makeRelease(root, nextRevision, 'next');
    symlinkSync(previous, join(root, 'current'));
    let restarts = 0;

    try {
        await expect(
            activateGrottoRelease({
                deployRoot: root,
                restartServer: () => {
                    restarts += 1;
                    return '101';
                },
                serverHealthy: () => Promise.resolve(false),
                sourceRevision: nextRevision,
            })
        ).rejects.toThrow('rolled back');

        expect(readlinkSync(join(root, 'current'))).toBe(previous);
        expect(restarts).toBe(2);
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
});

test('refuses activation when the current release cannot be verified', async () => {
    const root = mkdtempSync(join(tmpdir(), 'grotto-corrupt-current-'));
    const previous = makeRelease(root, previousRevision, 'previous');
    makeRelease(root, nextRevision, 'next');
    symlinkSync(previous, join(root, 'current'));
    unlinkSync(join(previous, 'bin/grotto-server'));
    let restarts = 0;

    try {
        await expect(
            activateGrottoRelease({
                deployRoot: root,
                restartServer: () => {
                    restarts += 1;
                    return '101';
                },
                serverHealthy: () => Promise.resolve(true),
                sourceRevision: nextRevision,
            })
        ).rejects.toThrow();

        expect(readlinkSync(join(root, 'current'))).toBe(previous);
        expect(restarts).toBe(0);
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
});

test('refuses a cwd-dependent relative current release target', async () => {
    const root = mkdtempSync(join(tmpdir(), 'grotto-relative-current-'));
    makeRelease(root, previousRevision, 'previous');
    makeRelease(root, nextRevision, 'next');
    symlinkSync(join('releases', previousRevision), join(root, 'current'));

    try {
        await expect(
            activateGrottoRelease({
                deployRoot: root,
                restartServer: () => '101',
                serverHealthy: () => Promise.resolve(true),
                sourceRevision: nextRevision,
            })
        ).rejects.toThrow('absolute release path');
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
});

test('accepts health only after launchd reports a different Server process', async () => {
    const pids = ['101', '101', '202', '202'];
    const health = [true, true];
    let healthChecks = 0;

    expect(
        await waitForRestartedServerHealth('101', {
            readServerPid: () => pids.shift() ?? null,
            serverHealthy: async () => {
                healthChecks += 1;
                return health.shift() ?? false;
            },
            sleep: () => Promise.resolve(),
        })
    ).toBeTrue();
    expect(healthChecks).toBe(1);
});

test('rejects a privileged activation helper beneath a user-writable path', async () => {
    const helperPath = '/usr/local/libexec/grotto/activate-grotto-server';
    const secure = (path: string) =>
        Promise.resolve({
            mode: path === helperPath ? 0o10_0755 : 0o04_0755,
            uid: 0,
        });

    await expect(
        assertPrivilegedActivationHelper(helperPath, async (path) =>
            path === '/usr/local/libexec' ? { mode: 0o4_0775, uid: 0 } : secure()
        )
    ).rejects.toThrow('root-owned and not writable');
    await expect(
        assertPrivilegedActivationHelper('/Users/zknicker/services/bin/helper', secure)
    ).rejects.toThrow('exact root-owned path');
    await expect(assertPrivilegedActivationHelper(helperPath, secure)).resolves.toBeUndefined();
});

function makeRelease(root: string, sourceRevision: string, content: string) {
    const releaseRoot = join(root, 'releases', sourceRevision);
    mkdirSync(join(releaseRoot, 'bin'), { recursive: true });
    writeFileSync(join(releaseRoot, 'bin/grotto-server'), content);
    const checksums = `${sha256(content)}  ./bin/grotto-server\n`;
    writeFileSync(join(releaseRoot, 'release-files.sha256'), checksums);
    writeFileSync(
        join(releaseRoot, 'release.json'),
        `${JSON.stringify({
            contentDigest: sha256(checksums),
            productVersion: '1.6.2',
            releaseId: `1.6.2+git.${sourceRevision.slice(0, 12)}`,
            sourceRevision,
        })}\n`
    );
    return releaseRoot;
}

function sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
}
