import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
    installGrottoRelease,
    parseGrottoDeployArguments,
    readGrottoBuildValue,
} from '../../../scripts/deploy-grotto-server.ts';

const sourceRevision = '0123456789abcdef0123456789abcdef01234567';

test('reads one public build value without evaluating the host environment file', () => {
    const root = mkdtempSync(join(tmpdir(), 'grotto-build-env-'));
    const envPath = join(root, '.env');
    const sideEffect = join(root, 'should-not-exist');

    try {
        writeFileSync(
            envPath,
            [
                `UNRELATED=$(touch ${sideEffect})`,
                'VITE_CLERK_PUBLISHABLE_KEY="pk_test_fixture"',
                '',
            ].join('\n')
        );

        expect(readGrottoBuildValue(envPath, 'VITE_CLERK_PUBLISHABLE_KEY')).toBe('pk_test_fixture');
        expect(existsSync(sideEffect)).toBeFalse();
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
});

test('accepts only the published-version deploy argument shape forwarded by Bun', () => {
    expect(parseGrottoDeployArguments(['--', 'v1.6.2', 'deploy', sourceRevision])).toEqual({
        productVersion: '1.6.2',
        sourceRevision,
        versionTag: 'v1.6.2',
    });
    expect(() => parseGrottoDeployArguments(['main', 'deploy', sourceRevision])).toThrow('Usage');
    expect(() => parseGrottoDeployArguments(['v1.6.2', 'activate', sourceRevision])).toThrow(
        'Usage'
    );
});

test('installs one immutable full-revision release and refuses changed content', async () => {
    const root = mkdtempSync(join(tmpdir(), 'grotto-deploy-'));

    try {
        const firstArtifact = makeArtifact(root, 'first');
        const installed = await installGrottoRelease({
            artifactPath: firstArtifact,
            deployRoot: root,
            sourceRevision,
        });
        expect(installed).toBe(join(root, 'releases', sourceRevision));
        expect(statSync(installed).mode & 0o777).toBe(0o755);
        expect(readFileSync(join(installed, 'bin/grotto-server'), 'utf8')).toBe('first');

        expect(
            await installGrottoRelease({
                artifactPath: firstArtifact,
                deployRoot: root,
                sourceRevision,
            })
        ).toBe(installed);

        const changedArtifact = makeArtifact(root, 'changed');
        await expect(
            installGrottoRelease({
                artifactPath: changedArtifact,
                deployRoot: root,
                sourceRevision,
            })
        ).rejects.toThrow('already exists with different content');
        expect(readFileSync(join(installed, 'bin/grotto-server'), 'utf8')).toBe('first');
    } finally {
        rmSync(root, { force: true, recursive: true });
    }
});

function makeArtifact(root: string, content: string) {
    const stage = mkdtempSync(join(root, 'stage-'));
    mkdirSync(join(stage, 'bin'));
    writeFileSync(join(stage, 'bin/grotto-server'), content);

    const fileDigest = sha256(content);
    const checksums = `${fileDigest}  ./bin/grotto-server\n`;
    writeFileSync(join(stage, 'release-files.sha256'), checksums);
    writeFileSync(
        join(stage, 'release.json'),
        `${JSON.stringify({
            contentDigest: sha256(checksums),
            productVersion: '1.6.2',
            releaseId: `1.6.2+git.${sourceRevision.slice(0, 12)}`,
            sourceRevision,
        })}\n`
    );

    const artifactPath = join(root, `fixture-${content}.tar.gz`);
    expect(Bun.spawnSync(['/usr/bin/tar', '-czf', artifactPath, '-C', stage, '.']).exitCode).toBe(
        0
    );
    writeFileSync(
        `${artifactPath}.sha256`,
        `${sha256(readFileSync(artifactPath))}  ${basename(artifactPath)}\n`
    );
    rmSync(stage, { force: true, recursive: true });
    return artifactPath;
}

function sha256(value: Buffer | string) {
    return createHash('sha256').update(value).digest('hex');
}
