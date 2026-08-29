import {
    assertReleaseLedger,
    latestProductVersion,
    latestTargetVersion,
    releasePublishesTarget,
    releaseTargetBuildNumber,
} from './release-ledger.mjs';
import { readJson, readText, updateJson, writeText } from './release-utils.mjs';

const paths = {
    agent: 'packages/grotto-api/grotto-agent.json',
    product: 'packages/grotto-api/grotto-product.json',
    computer: 'apps/computer/package.json',
    iosProject: 'apps/ios-swift/project.yml',
    iosGeneratedProject: 'apps/ios-swift/Grotto.xcodeproj/project.pbxproj',
    lockfile: 'bun.lock',
    website: 'apps/website/package.json',
};

export function releaseVersionMetadata(ledger) {
    assertReleaseLedger(ledger);
    return {
        agent: latestTargetVersion(ledger, 'agent'),
        app: latestTargetVersion(ledger, 'app'),
        computer: latestTargetVersion(ledger, 'computer'),
        ios: latestPublishedIOS(ledger),
        product: latestProductVersion(ledger),
        server: latestTargetVersion(ledger, 'server'),
    };
}

export async function syncReleaseVersionMetadata(ledger) {
    const expected = releaseVersionMetadata(ledger);
    await updatePackageVersion(paths.product, expected.product);
    if (expected.app) {
        await updatePackageVersion(paths.website, expected.app);
    }
    if (expected.computer) {
        await updatePackageVersion(paths.computer, expected.computer);
    }
    if (expected.agent) {
        await updatePackageVersion(paths.agent, expected.agent);
    }
    await syncLockfile(expected);
    if (expected.ios) {
        await syncIOS(expected.ios);
    }
    return expected;
}

export async function assertReleaseVersionMetadata(ledger) {
    const expected = releaseVersionMetadata(ledger);
    const product = await readJson(paths.product);
    assertEqual(product.version, expected.product, 'Grotto product version');

    const lockfile = await readText(paths.lockfile);
    if (expected.app) {
        const website = await readJson(paths.website);
        assertEqual(website.version, expected.app, 'App package version');
        assertEqual(
            readWorkspaceVersion(lockfile, 'apps/website'),
            expected.app,
            'App lockfile version'
        );
    }

    if (expected.computer) {
        const computer = await readJson(paths.computer);
        assertEqual(computer.version, expected.computer, 'Computer package version');
        assertEqual(
            readWorkspaceVersion(lockfile, 'apps/computer'),
            expected.computer,
            'Computer lockfile version'
        );
    }

    if (expected.agent) {
        const agent = await readJson(paths.agent);
        assertEqual(agent.version, expected.agent, 'Grotto Agent manifest version');
    }

    if (expected.ios) {
        const project = await readText(paths.iosProject);
        const generated = await readText(paths.iosGeneratedProject);
        assertMatchesEvery(
            project,
            /MARKETING_VERSION: (\d+\.\d+\.\d+)/gu,
            expected.ios.version,
            'iOS project marketing version'
        );
        assertMatchesEvery(
            project,
            /CURRENT_PROJECT_VERSION: "?(\d+)"?/gu,
            String(expected.ios.buildNumber),
            'iOS project build number'
        );
        assertMatchesEvery(
            generated,
            /MARKETING_VERSION = (\d+\.\d+\.\d+);/gu,
            expected.ios.version,
            'generated iOS marketing version'
        );
        assertMatchesEvery(
            generated,
            /CURRENT_PROJECT_VERSION = (\d+);/gu,
            String(expected.ios.buildNumber),
            'generated iOS build number'
        );
    }

    return expected;
}

async function updatePackageVersion(relativePath, version) {
    await updateJson(relativePath, (manifest) => ({ ...manifest, version }));
}

async function syncLockfile(expected) {
    const raw = await readText(paths.lockfile);
    let next = raw;
    if (expected.app) {
        next = replaceWorkspaceVersion(next, 'apps/website', expected.app);
    }
    if (expected.computer) {
        next = replaceWorkspaceVersion(next, 'apps/computer', expected.computer);
    }
    if (next !== raw) {
        await writeText(paths.lockfile, next);
    }
}

async function syncIOS(ios) {
    const project = await readText(paths.iosProject);
    const nextProject = replaceEvery(
        replaceEvery(
            project,
            /(MARKETING_VERSION: )\d+\.\d+\.\d+/gu,
            `$1${ios.version}`,
            'iOS project marketing version'
        ),
        /(CURRENT_PROJECT_VERSION: )"?\d+"?/gu,
        `$1"${ios.buildNumber}"`,
        'iOS project build number'
    );
    if (nextProject !== project) {
        await writeText(paths.iosProject, nextProject);
    }

    const generated = await readText(paths.iosGeneratedProject);
    const nextGenerated = replaceEvery(
        replaceEvery(
            generated,
            /(MARKETING_VERSION = )\d+\.\d+\.\d+(;)/gu,
            `$1${ios.version}$2`,
            'generated iOS marketing version'
        ),
        /(CURRENT_PROJECT_VERSION = )\d+(;)/gu,
        `$1${ios.buildNumber}$2`,
        'generated iOS build number'
    );
    if (nextGenerated !== generated) {
        await writeText(paths.iosGeneratedProject, nextGenerated);
    }
}

function latestPublishedIOS(ledger) {
    for (let index = ledger.length - 1; index >= 0; index -= 1) {
        const entry = ledger[index];
        if (releasePublishesTarget(entry, 'ios')) {
            return {
                buildNumber: releaseTargetBuildNumber(entry),
                version: latestTargetVersion(ledger.slice(0, index + 1), 'ios'),
            };
        }
    }
    return null;
}

function workspaceBlock(raw, workspace) {
    const startMarker = `    "${workspace}": {`;
    const start = raw.indexOf(startMarker);
    if (start === -1) {
        throw new Error(`bun.lock is missing workspace ${workspace}`);
    }
    const end = raw.indexOf('\n    "', start + startMarker.length);
    return {
        end: end === -1 ? raw.length : end,
        start,
    };
}

function readWorkspaceVersion(raw, workspace) {
    const { start, end } = workspaceBlock(raw, workspace);
    const match = raw.slice(start, end).match(/\n {6}"version": "([^"]+)",/u);
    if (!match) {
        throw new Error(`bun.lock workspace ${workspace} is missing its version`);
    }
    return match[1];
}

function replaceWorkspaceVersion(raw, workspace, version) {
    const { start, end } = workspaceBlock(raw, workspace);
    const block = raw.slice(start, end);
    const next = block.replace(/(\n {6}"version": ")[^"]+(",)/u, `$1${version}$2`);
    if (next === block && readWorkspaceVersion(raw, workspace) !== version) {
        throw new Error(`could not update bun.lock workspace ${workspace}`);
    }
    return `${raw.slice(0, start)}${next}${raw.slice(end)}`;
}

function replaceEvery(raw, pattern, replacement, label) {
    const matches = Array.from(raw.matchAll(pattern));
    if (matches.length === 0) {
        throw new Error(`could not find ${label}`);
    }
    return raw.replace(pattern, replacement);
}

function assertMatchesEvery(raw, pattern, expected, label) {
    const values = Array.from(raw.matchAll(pattern), (match) => match[1]);
    if (values.length === 0) {
        throw new Error(`could not find ${label}`);
    }
    const mismatched = values.find((value) => value !== expected);
    if (mismatched) {
        throw new Error(`${label} ${mismatched} must match releases.json ${expected}`);
    }
}

function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label} ${String(actual)} must match releases.json ${expected}`);
    }
}
