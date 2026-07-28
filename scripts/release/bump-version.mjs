#!/usr/bin/env node

import { resetReleaseSurfaceDecision } from './release-surfaces.mjs';
import {
    compareVersions,
    fail,
    isSemver,
    parseVersion,
    readJson,
    readText,
    updateJson,
} from './release-utils.mjs';

const changelogPath = 'CHANGELOG.md';

const releaseType = process.argv[2];
const flags = new Set(process.argv.slice(3));
const bumpRuntime = flags.has('--runtime');
const requireRuntime = flags.has('--require-runtime');

if (!releaseType || releaseType === '--help' || releaseType === '-h') {
    printUsage();
    process.exit(releaseType ? 0 : 1);
}

if (requireRuntime && !bumpRuntime) {
    fail('--require-runtime requires --runtime');
}

const main = async () => {
    const currentVersion = await readCurrentVersion();
    const latestChangelogVersion = await readLatestChangelogVersion();

    if (latestChangelogVersion !== currentVersion) {
        fail(
            `latest changelog version (${latestChangelogVersion}) must match current app version (${currentVersion}) before bumping`
        );
    }

    const targetVersion = resolveTargetVersion(currentVersion, releaseType);

    if (targetVersion === currentVersion) {
        fail(`target version ${targetVersion} matches current version`);
    }

    if (compareVersions(targetVersion, currentVersion) <= 0) {
        fail(`target version ${targetVersion} must be greater than current ${currentVersion}`);
    }

    await updateVersionedFiles(targetVersion, {
        bumpRuntime,
        requireRuntime,
    });
    await updateJson('release-surfaces.json', () => resetReleaseSurfaceDecision(targetVersion));

    printSummary({ bumpRuntime, currentVersion, requireRuntime, targetVersion });
};

await main();

function printUsage() {
    console.log(
        [
            'Usage: bun run release:bump <patch|minor|major|X.Y.Z>',
            '',
            'Examples:',
            '  bun run release:bump patch',
            '  bun run release:bump patch -- --runtime',
            '  bun run release:bump patch -- --runtime --require-runtime',
            '  bun run release:bump 1.0.1',
        ].join('\n')
    );
}

async function readCurrentVersion() {
    const version = await readWebsiteVersion();
    if (!isSemver(version)) {
        fail(`invalid current version: ${version}`);
    }

    return version;
}

async function readWebsiteVersion() {
    const packageJson = await readJson('apps/website/package.json');
    return packageJson.version;
}

async function readLatestChangelogVersion() {
    const changelog = await readText(changelogPath);
    if (/(^|\n)## Unreleased\s*$/m.test(changelog)) {
        fail('CHANGELOG.md must not contain ## Unreleased');
    }

    const match = changelog.match(/^## v(\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2})$/m);
    if (!match) {
        fail('could not find latest release heading in CHANGELOG.md');
    }

    return match[1];
}

function resolveTargetVersion(currentVersion, input) {
    if (input === 'patch' || input === 'minor' || input === 'major') {
        return bumpVersion(currentVersion, input);
    }

    if (!isSemver(input)) {
        fail(`invalid target version: ${input}`);
    }

    return input;
}

function bumpVersion(version, type) {
    const parsed = parseVersion(version);
    if (!parsed) {
        fail(`invalid current version: ${version}`);
    }

    if (type === 'patch') {
        return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    }

    if (type === 'minor') {
        return `${parsed.major}.${parsed.minor + 1}.0`;
    }

    return `${parsed.major + 1}.0.0`;
}

async function updateVersionedFiles(targetVersion, options) {
    await updateJson('apps/website/package.json', (packageJson) => {
        packageJson.version = targetVersion;

        if (options.requireRuntime) {
            packageJson.tavern ??= {};
            packageJson.tavern.runtime ??= {};
            packageJson.tavern.runtime.minimumVersion = targetVersion;
        }

        return packageJson;
    });

    if (options.bumpRuntime) {
        await updateJson('apps/runtime/package.json', (packageJson) => {
            packageJson.version = targetVersion;
            return packageJson;
        });
    }
}

function printSummary({ bumpRuntime, currentVersion, requireRuntime, targetVersion }) {
    console.log(`Bumped release version ${currentVersion} -> ${targetVersion}`);
    console.log('Updated files:');
    console.log('- apps/website/package.json');
    console.log('- release-surfaces.json');
    if (bumpRuntime) {
        console.log('- apps/runtime/package.json');
    }
    if (requireRuntime) {
        console.log('- apps/website/package.json tavern.runtime.minimumVersion');
    }
    console.log('Next:');
    console.log('- bun install --frozen-lockfile');
    console.log('- bun run release:collect-changelog-context');
    console.log('- decide publish or unchanged for every surface in release-surfaces.json');
    console.log('- update CHANGELOG.md using commit analysis');
    console.log('- bun run release:check');
}
