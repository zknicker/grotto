#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findGrottoServerReleaseAssets } from './grotto-server-release-assets.mjs';
import { fail, isSemver, readFlagValue, readJson, readText, repoRoot } from './release-utils.mjs';

const argv = process.argv.slice(2);
const pushBranch = readFlagValue(argv, '--push-branch') ?? 'main';
const publishRuntime = argv.includes('--runtime');

if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(0);
}

const allowedDirtyPaths = new Set([
    'CHANGELOG.md',
    'apps/runtime/package.json',
    'apps/website/package.json',
]);
const bundleRoot = path.join(repoRoot, 'apps', 'website', 'electron-dist');
const runtimeBundleDir = path.join(repoRoot, 'apps', 'website', 'electron-dist', 'runtime');
const serverReleaseRoot = path.join(repoRoot, 'apps', 'server', 'release');

const main = async () => {
    const version = await readReleaseVersion();
    const tagName = `v${version}`;

    assertVersion(version);
    assertNoTag(tagName);
    run('bun', ['run', 'release:check']);
    if (publishRuntime) {
        await assertRuntimeReleaseVersion(version);
    }

    const releasePaths = readReleaseDirtyPaths();
    stageReleasePaths(releasePaths);
    commitReleaseIfNeeded(tagName);
    const sourceRevision = readSourceRevision();
    run('bun', ['run', 'build:grotto-server-artifact'], {
        env: { ...process.env, GROTTO_SOURCE_REVISION: sourceRevision },
    });

    if (publishRuntime) {
        run('bun', ['run', 'release:build-runtime-artifact']);
    }
    process.env.TAVERN_RELEASE_INCLUDE_RUNTIME = publishRuntime ? '1' : '0';
    run('bun', ['run', 'publish:desktop']);
    run('bun', ['run', 'release:check-desktop-artifacts']);

    const notesPath = await writeReleaseNotes(version);
    const artifacts = await findReleaseArtifacts({
        includeRuntime: publishRuntime,
        sourceRevision,
        version,
    });

    createTag(tagName);
    pushRelease({ pushBranch, tagName });
    createGithubRelease({ artifacts, notesPath, tagName });
    if (publishRuntime) {
        run('bun', ['run', 'release:publish-homebrew-formula']);
    }

    console.log(`Released ${tagName}`);
};

await main();

function printUsage() {
    console.log(
        [
            'Usage: bun run release:publish [-- --push-branch main]',
            '       bun run release:publish -- --runtime',
            '',
            'Builds the hosted Server plus signed desktop artifacts, notarizes the app,',
            'pushes the release commit and tag, and creates the GitHub Release.',
            'Pass --runtime to also build/publish the Runtime tarball and Homebrew formula.',
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

async function assertRuntimeReleaseVersion(appVersion) {
    const runtimePackage = await readJson('apps/runtime/package.json');
    if (runtimePackage.version !== appVersion) {
        fail('Runtime releases must use the same version as the desktop release tag', {
            app: appVersion,
            runtime: runtimePackage.version,
        });
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

function pushRelease({ pushBranch, tagName }) {
    run('git', ['push', 'origin', `HEAD:${pushBranch}`]);
    run('git', ['push', 'origin', tagName]);
}

async function writeReleaseNotes(version) {
    const notes = extractReleaseNotes(await readText('CHANGELOG.md'), version);
    const notesDirectory = mkdtempSync(path.join(tmpdir(), 'tavern-release-'));
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

async function findReleaseArtifacts({ includeRuntime, sourceRevision, version }) {
    const artifacts = [
        ...(await findDesktopArtifacts(version)),
        path.join(bundleRoot, 'latest-mac.yml'),
        ...(await findGrottoServerReleaseAssets({
            releaseRoot: serverReleaseRoot,
            sourceRevision,
            version,
        })),
        ...(includeRuntime ? await findRuntimeArtifacts(version) : []),
    ];

    if (!artifacts.some((artifact) => path.basename(artifact).endsWith('.dmg'))) {
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

async function findRuntimeArtifacts(version) {
    const files = await readdir(runtimeBundleDir);
    const expectedPrefix = `grotto-runtime-${version}-`;
    const artifacts = files
        .filter((entry) => entry.startsWith(expectedPrefix) && entry.includes('.tar.gz'))
        .map((entry) => path.join(runtimeBundleDir, entry));

    if (artifacts.length === 0) {
        fail(`could not find runtime artifact for ${version}`, { files });
    }

    return artifacts;
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
