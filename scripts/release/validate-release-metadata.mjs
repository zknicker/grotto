#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseSurfaceDecision, formatReleaseSurfaceDecision } from './release-surfaces.mjs';
import { isRuntimeVersionAcceptedByApp } from './release-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);

const expectedVersion = resolveExpectedVersion(process.argv.slice(2));

const versionedFiles = {
    runtime: 'apps/runtime/package.json',
    website: 'apps/website/package.json',
    electronBuilder: 'apps/website/electron-builder.config.cjs',
};

const changelogPath = 'CHANGELOG.md';

const main = async () => {
    const websitePackage = await readJson(versionedFiles.website);
    const runtimePackage = await readJson(versionedFiles.runtime);
    const electronBuilderConfig = require(path.join(repoRoot, versionedFiles.electronBuilder));

    const releaseVersion = assertReleaseVersion(websitePackage.version);
    assertRuntimeCompatibilityMetadata({
        appVersion: releaseVersion,
        requiredRuntimeVersion: websitePackage.tavern?.runtime?.minimumVersion,
        runtimeVersion: runtimePackage.version,
    });

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
    const surfaceDecision = await readJson('release-surfaces.json');
    try {
        const result = assertReleaseSurfaceDecision(surfaceDecision, {
            requireDecision: Boolean(expectedVersion),
            targetVersion:
                surfaceDecision.targetVersion === null && !expectedVersion
                    ? undefined
                    : releaseVersion,
        });
        if (result.complete) {
            assert(
                latestRelease.body.includes(formatReleaseSurfaceDecision(surfaceDecision)),
                'latest changelog entry must include the exact release surface decision'
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

function assertRuntimeCompatibilityMetadata(input) {
    if (!isSemver(input.runtimeVersion)) {
        fail(`invalid runtime package version: ${input.runtimeVersion}`);
    }

    if (!input.requiredRuntimeVersion) {
        fail('apps/website/package.json must declare tavern.runtime.minimumVersion');
    }

    if (!isSemver(input.requiredRuntimeVersion)) {
        fail(`invalid required Runtime version: ${input.requiredRuntimeVersion}`);
    }

    if (compareVersions(input.requiredRuntimeVersion, input.appVersion) > 0) {
        fail('required Runtime version cannot be newer than the app release version', input);
    }

    if (
        !isRuntimeVersionAcceptedByApp({
            appVersion: input.appVersion,
            minimumVersion: input.requiredRuntimeVersion,
            runtimeVersion: input.runtimeVersion,
        })
    ) {
        fail('runtime package version must satisfy the app Runtime compatibility floor', input);
    }
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

function compareVersions(left, right) {
    const leftParts = parseVersion(left);
    const rightParts = parseVersion(right);

    if (leftParts.major !== rightParts.major) {
        return leftParts.major > rightParts.major ? 1 : -1;
    }

    if (leftParts.minor !== rightParts.minor) {
        return leftParts.minor > rightParts.minor ? 1 : -1;
    }

    if (leftParts.patch !== rightParts.patch) {
        return leftParts.patch > rightParts.patch ? 1 : -1;
    }

    return 0;
}

function parseVersion(value) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) {
        fail(`invalid semver value: ${value}`);
    }

    return {
        major: Number.parseInt(match[1], 10),
        minor: Number.parseInt(match[2], 10),
        patch: Number.parseInt(match[3], 10),
    };
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
