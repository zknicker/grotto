#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseLedger, latestMainVersion } from './release-ledger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);

const expectedVersion = resolveExpectedVersion(process.argv.slice(2));

const versionedFiles = {
    website: 'apps/website/package.json',
    electronBuilder: 'apps/website/electron-builder.config.cjs',
};

const changelogPath = 'CHANGELOG.md';

const main = async () => {
    const websitePackage = await readJson(versionedFiles.website);
    const electronBuilderConfig = require(path.join(repoRoot, versionedFiles.electronBuilder));

    const releaseVersion = assertReleaseVersion(websitePackage.version);

    assert(
        electronBuilderConfig.appId === 'build.grotto.desktop',
        'desktop app identifier must be build.grotto.desktop'
    );
    await assertElectronMainRequiresPackaged({
        electronBuilderConfig,
        mainPath: 'apps/website/electron/main.cjs',
    });

    const changelog = await readText(changelogPath);
    assert(
        !/(^|\n)## Unreleased\s*$/m.test(changelog),
        'CHANGELOG.md must not contain ## Unreleased'
    );
    const latestRelease = parseLatestReleaseFromChangelog(changelog);

    assert(
        latestRelease.version === releaseVersion,
        'latest changelog version must match Server version'
    );

    if (expectedVersion) {
        assert(
            expectedVersion === releaseVersion,
            `expected version ${expectedVersion} does not match ${releaseVersion}`
        );
    }
    try {
        const ledger = await readJson('releases.json');
        const result = assertReleaseLedger(ledger, {
            requireComplete: Boolean(expectedVersion),
        });
        assert(
            latestMainVersion(ledger) === releaseVersion,
            'latest release ledger Server version must match the website version'
        );
        if (result.complete && result.latest.version !== null) {
            assert(
                result.latest.version === latestRelease.version,
                'latest release ledger version must match the latest changelog version'
            );
        }
        if (expectedVersion) {
            assert(
                result.latest.version === expectedVersion,
                'latest release ledger entry must match the expected Server version'
            );
        }
    } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
    }

    console.log('release:check passed');
    console.log(`version: ${releaseVersion}`);
    console.log(`changelog date: ${latestRelease.date}`);
};

await main();

function resolveExpectedVersion(argv) {
    const expectIndex = argv.indexOf('--expect-version');
    if (expectIndex === -1) {
        const ref = process.env.GITHUB_REF ?? '';
        if (!ref.startsWith('refs/tags/v')) {
            return null;
        }

        return ref.replace('refs/tags/v', '');
    }

    const value = argv[expectIndex + 1];
    if (!value) {
        fail('missing value for --expect-version');
    }

    if (!isSemver(value)) {
        fail(`invalid --expect-version value: ${value}`);
    }

    return value;
}

function assertReleaseVersion(version) {
    if (!isSemver(version)) {
        fail(`invalid release version: ${version}`);
    }

    return version;
}

function parseLatestReleaseFromChangelog(changelog) {
    const pattern = /^## v(\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2})$/gm;
    const match = pattern.exec(changelog);
    if (!match) {
        fail('could not find release heading in CHANGELOG.md');
    }

    return {
        version: match[1],
        date: match[2],
        body: changelog.slice(pattern.lastIndex, pattern.exec(changelog)?.index).trim(),
    };
}

async function readJson(relativePath) {
    const content = await readText(relativePath);
    return JSON.parse(content);
}

async function readText(relativePath) {
    const absolutePath = path.join(repoRoot, relativePath);
    return readFile(absolutePath, 'utf8');
}

async function assertElectronMainRequiresPackaged(input) {
    const mainContent = await readText(input.mainPath);
    const packageFiles = input.electronBuilderConfig.files ?? [];
    const packageFileSet = new Set(packageFiles);
    const mainDirectory = path.posix.dirname(input.mainPath.replace(/^apps\/website\//u, ''));
    const localRequirePattern = /require\(['"](\.\/[^'"]+)['"]\)/gu;
    const missingFiles = [];

    for (const match of mainContent.matchAll(localRequirePattern)) {
        const requiredPath = `${path.posix.join(mainDirectory, match[1])}`;

        if (!packageFileSet.has(requiredPath)) {
            missingFiles.push(requiredPath);
        }
    }

    if (missingFiles.length > 0) {
        fail('desktop Electron package is missing files required by main.cjs', {
            missingFiles,
            packageFiles,
        });
    }
}

function isSemver(value) {
    return /^\d+\.\d+\.\d+$/.test(value);
}

function assert(condition, message) {
    if (!condition) {
        fail(message);
    }
}

function fail(message, details) {
    console.error(`release:check error: ${message}`);
    if (details) {
        console.error(JSON.stringify(details, null, 4));
    }

    process.exit(1);
}
