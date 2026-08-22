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
    writeText,
} from './release-utils.mjs';

const changelogPath = 'CHANGELOG.md';

const releaseType = process.argv[2];

if (!releaseType || releaseType === '--help' || releaseType === '-h') {
    printUsage();
    process.exit(releaseType ? 0 : 1);
}

const main = async () => {
    const currentVersion = await readCurrentVersion();
    const latestChangelogVersion = await readLatestChangelogVersion();

    if (latestChangelogVersion !== currentVersion) {
        fail(
            `latest changelog version (${latestChangelogVersion}) must match current Server version (${currentVersion}) before bumping`
        );
    }

    const targetVersion = resolveTargetVersion(currentVersion, releaseType);

    if (targetVersion === currentVersion) {
        fail(`target version ${targetVersion} matches current version`);
    }

    if (compareVersions(targetVersion, currentVersion) <= 0) {
        fail(`target version ${targetVersion} must be greater than current ${currentVersion}`);
    }

    await updateVersionedFiles(targetVersion);
    await updateJson('release-surfaces.json', () => resetReleaseSurfaceDecision(targetVersion));

    printSummary({ currentVersion, targetVersion });
};

await main();

function printUsage() {
    console.log(
        [
            'Usage: bun run release:bump <patch|minor|major|X.Y.Z>',
            '',
            'Examples:',
            '  bun run release:bump patch',
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

async function updateVersionedFiles(targetVersion) {
    await updateJson('apps/website/package.json', (packageJson) => {
        packageJson.version = targetVersion;
        return packageJson;
    });
    await updateIOSLocalDefaultVersion(targetVersion);
}

const iosProjectSpecPath = 'apps/ios-swift/project.yml';

async function updateIOSLocalDefaultVersion(targetVersion) {
    const raw = await readText(iosProjectSpecPath);
    const pattern = /(MARKETING_VERSION: )\d+\.\d+\.\d+/;
    if (!pattern.test(raw)) {
        fail(`could not find MARKETING_VERSION in ${iosProjectSpecPath}`);
    }

    const next = raw.replace(pattern, `$1${targetVersion}`);
    if (next !== raw) {
        await writeText(iosProjectSpecPath, next);
    }
}

function printSummary({ currentVersion, targetVersion }) {
    console.log(`Bumped release version ${currentVersion} -> ${targetVersion}`);
    console.log('Updated files:');
    console.log('- apps/website/package.json');
    console.log('- apps/ios-swift/project.yml (local-build MARKETING_VERSION default)');
    console.log('- release-surfaces.json');
    console.log('Next:');
    console.log('- bun install --frozen-lockfile');
    console.log('- bun run release:collect-changelog-context');
    console.log('- decide publish or unchanged for every surface in release-surfaces.json');
    console.log('- update CHANGELOG.md using commit analysis');
    console.log('- bun run release:check');
}
