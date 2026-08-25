#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadAppReleaseEnvironment } from './app-release-environment.mjs';
import { checkComputerReleasePrerequisite } from './check-computer-prerequisite.mjs';
import { findGrottoServerReleaseAssets } from './grotto-server-release-assets.mjs';
import { releasePublishesSurface } from './release-surfaces.mjs';
import { fail, isSemver, readFlagValue, readJson, readText, repoRoot } from './release-utils.mjs';

const argv = process.argv.slice(2);
const pushBranch = readFlagValue(argv, '--push-branch') ?? 'main';

if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(0);
}

const allowedDirtyPaths = new Set([
    'CHANGELOG.md',
    'apps/website/package.json',
    'release-surfaces.json',
]);
const bundleRoot = path.join(repoRoot, 'apps', 'website', 'electron-dist');
const serverReleaseRoot = path.join(repoRoot, 'apps', 'server', 'release');

const main = async () => {
    loadAppReleaseEnvironment();
    const version = await readReleaseVersion();
    const tagName = `v${version}`;

    assertVersion(version);
    assertNoTag(tagName);
    run('bun', ['run', 'release:check', '--', '--expect-version', version]);
    const computerRelease = await checkComputerReleasePrerequisite().catch((error) => {
        fail('compatible Grotto Computer must be published before Server', {
            message: error instanceof Error ? error.message : String(error),
        });
    });
    console.log(
        `Computer prerequisite: ${computerRelease.version} (protocol ${computerRelease.protocolVersion})`
    );
    const surfaceDecision = await readJson('release-surfaces.json');
    const publishApp = releasePublishesSurface(surfaceDecision, 'app');
    if (
        surfaceDecision.surfaces.computer.action === 'publish' &&
        surfaceDecision.surfaces.computer.version !== computerRelease.version
    ) {
        fail('the declared Computer release is not the publicly verified production release', {
            declared: surfaceDecision.surfaces.computer.version,
            production: computerRelease.version,
        });
    }
    const releasePaths = readReleaseDirtyPaths();
    stageReleasePaths(releasePaths);
    commitReleaseIfNeeded(tagName);
    const sourceRevision = readSourceRevision();
    pushReleaseCommit(pushBranch);
    run('bun', ['run', 'build:grotto-server-artifact'], {
        env: { ...process.env, GROTTO_SOURCE_REVISION: sourceRevision },
    });

    if (publishApp) {
        run('bun', ['run', 'publish:desktop'], {
            env: {
                ...process.env,
                GROTTO_RELEASE_INCLUDE_DESKTOP: '1',
            },
        });
    }
    if (publishApp) {
        run('bun', ['run', 'release:check-desktop-artifacts']);
    }

    const notesPath = await writeReleaseNotes(version);
    const artifacts = await findReleaseArtifacts({
        includeDesktop: publishApp,
        sourceRevision,
        version,
    });

    createTag(tagName);
    pushReleaseTag({ pushBranch, tagName });
    createGithubRelease({ artifacts, notesPath, tagName });
    console.log(`Released ${tagName}`);
};

await main();

function printUsage() {
    console.log(
        [
            'Usage: bun run release:publish [-- --push-branch main]',
            '',
            'Builds the Server and each declared release surface,',
            'pushes the release commit and tag, and creates the GitHub Release.',
        ].join('\n')
    );
}

async function readReleaseVersion() {
    const packageJson = await readJson('apps/website/package.json');
    return packageJson.version;
}

function assertVersion(version) {
    if (!isSemver(version)) {
        fail(`invalid release version: ${version}`);
    }
}

function assertNoTag(tagName) {
    const localTag = spawnSync(
        'git',
        ['rev-parse', '--verify', '--quiet', `refs/tags/${tagName}`],
        {
            cwd: repoRoot,
            stdio: 'ignore',
        }
    );
    if (localTag.status === 0) {
        fail(`tag ${tagName} already exists locally`);
    }

    const remoteTag = spawnSync(
        'git',
        ['ls-remote', '--exit-code', 'origin', `refs/tags/${tagName}`],
        {
            cwd: repoRoot,
            encoding: 'utf8',
        }
    );
    if (remoteTag.status === 0) {
        fail(`tag ${tagName} already exists on origin`);
    }
}

function readReleaseDirtyPaths() {
    const status = runCapture('git', ['status', '--porcelain']);
    const dirtyPaths = status
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3).replace(/^.* -> /, ''));
    const unexpectedPaths = dirtyPaths.filter((filePath) => !allowedDirtyPaths.has(filePath));

    if (unexpectedPaths.length > 0) {
        fail('release has unexpected dirty files', { unexpectedPaths });
    }

    return dirtyPaths;
}

function stageReleasePaths(paths) {
    if (paths.length === 0) {
        return;
    }

    run('git', ['add', ...paths]);
}

function commitReleaseIfNeeded(tagName) {
    const diff = spawnSync('git', ['diff', '--cached', '--quiet'], {
        cwd: repoRoot,
        stdio: 'ignore',
    });

    if (diff.status === 0) {
        return;
    }

    run('git', ['commit', '-m', `release: ${tagName}`]);
}

function createTag(tagName) {
    run('git', ['tag', '-a', tagName, '-m', tagName]);
}

function readSourceRevision() {
    const sourceRevision = runCapture('git', ['rev-parse', 'HEAD']).trim();
    if (!/^[0-9a-f]{40}$/u.test(sourceRevision)) {
        fail('release source revision must be a full lowercase Git SHA');
    }
    return sourceRevision;
}

function pushReleaseCommit(pushBranch) {
    run('git', ['push', 'origin', `HEAD:${pushBranch}`]);
}

function pushReleaseTag({ pushBranch, tagName }) {
    run('git', ['fetch', 'origin', pushBranch]);
    const containsRelease = spawnSync(
        'git',
        ['merge-base', '--is-ancestor', 'HEAD', `origin/${pushBranch}`],
        {
            cwd: repoRoot,
            env: process.env,
            stdio: 'ignore',
        }
    );
    if (containsRelease.status !== 0) {
        fail(`origin/${pushBranch} no longer contains the release commit`);
    }
    run('git', ['push', 'origin', tagName]);
}

async function writeReleaseNotes(version) {
    const notes = extractReleaseNotes(await readText('CHANGELOG.md'), version);
    const notesDirectory = mkdtempSync(path.join(tmpdir(), 'grotto-release-'));
    const notesPath = path.join(notesDirectory, `${version}-notes.md`);
    writeFileSync(notesPath, `${notes}\n`, 'utf8');
    return notesPath;
}

function extractReleaseNotes(changelog, version) {
    const headingPattern = /^## v(\d+\.\d+\.\d+) - \d{4}-\d{2}-\d{2}$/gm;
    const headings = Array.from(changelog.matchAll(headingPattern));
    const targetIndex = headings.findIndex((match) => match[1] === version);

    if (targetIndex === -1) {
        fail(`could not find CHANGELOG.md entry for v${version}`);
    }

    const start = headings[targetIndex].index + headings[targetIndex][0].length;
    const end =
        targetIndex + 1 < headings.length ? headings[targetIndex + 1].index : changelog.length;
    const notes = changelog.slice(start, end).trim();

    if (!notes) {
        fail(`CHANGELOG.md entry for v${version} has no body`);
    }

    return notes;
}

async function findReleaseArtifacts({ includeDesktop, sourceRevision, version }) {
    const artifacts = [
        ...(includeDesktop ? await findDesktopArtifacts(version) : []),
        ...(includeDesktop ? [path.join(bundleRoot, 'latest-mac.yml')] : []),
        ...(await findGrottoServerReleaseAssets({
            releaseRoot: serverReleaseRoot,
            sourceRevision,
            version,
        })),
    ];

    if (includeDesktop && !artifacts.some((artifact) => path.basename(artifact).endsWith('.dmg'))) {
        fail('could not find expected Electron DMG artifact', {
            files: await readdir(bundleRoot),
        });
    }

    return artifacts;
}

async function findDesktopArtifacts(version) {
    const expectedPrefix = `Grotto_${version}_`;
    return await findFiles(
        bundleRoot,
        (entry) =>
            entry.startsWith(expectedPrefix) &&
            (entry.endsWith('.dmg') || entry.endsWith('.zip') || entry.endsWith('.blockmap'))
    );
}

async function findFiles(directory, predicate) {
    return (await readdir(directory)).filter(predicate).map((entry) => path.join(directory, entry));
}

function createGithubRelease({ artifacts, notesPath, tagName }) {
    run('gh', [
        'release',
        'create',
        tagName,
        ...artifacts,
        '--title',
        tagName,
        '--notes-file',
        notesPath,
        '--latest',
    ]);
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: options.env ?? process.env,
        stdio: 'inherit',
    });

    if (result.error) {
        fail(`${command} failed`, { message: result.error.message });
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function runCapture(command, args) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        env: process.env,
        encoding: 'utf8',
    });

    if (result.error) {
        fail(`${command} failed`, { message: result.error.message });
    }

    if (result.status !== 0) {
        fail(`${command} exited with ${result.status}`, {
            stderr: result.stderr.trim(),
            stdout: result.stdout.trim(),
        });
    }

    return result.stdout;
}
