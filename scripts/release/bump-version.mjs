#!/usr/bin/env node

import {
    appendReleaseDraft,
    assertReleaseLedger,
    latestProductVersion,
} from './release-ledger.mjs';
import {
    compareVersions,
    fail,
    isSemver,
    parseVersion,
    readJson,
    readText,
    writeText,
} from './release-utils.mjs';
import { syncReleaseVersionMetadata } from './release-version-metadata.mjs';

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
            `latest changelog version (${latestChangelogVersion}) must match current Grotto version (${currentVersion}) before bumping`
        );
    }

    const targetVersion = resolveTargetVersion(currentVersion, releaseType);

    if (targetVersion === currentVersion) {
        fail(`target version ${targetVersion} matches current version`);
    }

    if (compareVersions(targetVersion, currentVersion) <= 0) {
        fail(`target version ${targetVersion} must be greater than current ${currentVersion}`);
    }

    const ledger = await readJson('releases.json');
    try {
        assertReleaseLedger(ledger, { requireComplete: true });
        if (latestProductVersion(ledger) !== currentVersion) {
            fail(
                `latest release ledger Grotto version (${latestProductVersion(ledger)}) must match current Grotto version (${currentVersion}) before bumping`
            );
        }
    } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
    }

    const nextLedger = await appendLedgerDraft(ledger, targetVersion);
    await syncReleaseVersionMetadata(nextLedger);

    printSummary({ currentVersion, targetVersion });
};

function printUsage() {
    console.log(
        [
            'Usage: bun run release:bump <patch|minor|major|X.Y.Z>',
            '',
            'Examples:',
            '  bun run release:bump patch',
            '  bun run release:bump 2.0.0',
        ].join('\n')
    );
}

async function appendLedgerDraft(ledger, targetVersion) {
    let nextLedger;
    try {
        nextLedger = appendReleaseDraft(ledger, targetVersion);
    } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
    }

    const rawLedger = await readText('releases.json');
    const closingBracket = /\n\]\n$/u;
    if (!closingBracket.test(rawLedger)) {
        fail('releases.json must end with a newline-delimited array bracket');
    }
    const draft = JSON.stringify(nextLedger.at(-1), null, 2)
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
    await writeText('releases.json', rawLedger.replace(closingBracket, `,\n${draft}\n]\n`));
    return nextLedger;
}

async function readCurrentVersion() {
    const version = await readProductVersion();
    if (!isSemver(version)) {
        fail(`invalid current version: ${version}`);
    }

    return version;
}

async function readProductVersion() {
    const product = await readJson('packages/grotto-api/grotto-product.json');
    return product.version;
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

function printSummary({ currentVersion, targetVersion }) {
    console.log(`Bumped release version ${currentVersion} -> ${targetVersion}`);
    console.log('Updated files:');
    console.log('- packages/grotto-api/grotto-product.json');
    console.log('- releases.json (append the next release draft)');
    console.log('Next:');
    console.log('- apply every target version/build decision to the new releases.json entry');
    console.log('- bun run release:sync-versions');
    console.log('- update CHANGELOG.md from that target-scoped evidence');
    console.log('- bun run release:check');
}

await main();
