import { compareVersions, isSemver } from './release-utils.mjs';

export const releaseTargetNames = ['server', 'app', 'ios', 'computer', 'agent'];
export const undecidedReleaseTarget = 'undecided';

const targetLabels = {
    server: 'Server',
    app: 'App',
    ios: 'iOS',
    computer: 'Computer',
    agent: 'Grotto Agent',
};

export function assertReleaseLedger(value, options = {}) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error('release ledger must contain at least one entry');
    }

    let previousDate = null;
    let previousVersion = null;
    let previousAgentVersion = null;

    for (const [index, entry] of value.entries()) {
        const isLatest = index === value.length - 1;
        assertReleaseEntry(entry, { allowLegacyVersionless: !isLatest, allowUndecided: true });

        if (!isLatest && isDraftRelease(entry)) {
            throw new Error('only the latest release ledger entry may be a draft');
        }
        if (
            previousVersion &&
            entry.version &&
            compareVersions(entry.version, previousVersion) <= 0
        ) {
            throw new Error('release ledger Grotto versions must be oldest-first');
        }
        if (!isDraftRelease(entry)) {
            assertCompleteRelease(entry);
            if (previousDate && entry.date < previousDate) {
                throw new Error('release ledger entries must be oldest-first by date');
            }
            if (entry.version) {
                previousVersion = entry.version;
            }
            const agentVersion = releaseTargetVersion(entry, 'agent');
            if (
                previousAgentVersion &&
                agentVersion &&
                compareVersions(agentVersion, previousAgentVersion) <= 0
            ) {
                throw new Error('Grotto Agent versions must be oldest-first');
            }
            if (agentVersion) {
                previousAgentVersion = agentVersion;
            }
            previousDate = entry.date;
        }
    }

    const latest = value.at(-1);
    const complete = !isDraftRelease(latest);
    if (options.requireComplete && !complete) {
        throw new Error('latest release ledger entry is still a draft');
    }

    return { complete, latest, value };
}

export function assertCompleteReleaseEntry(entry) {
    assertReleaseEntry(entry);
    if (isDraftRelease(entry)) {
        throw new Error('release ledger entry is still a draft');
    }
    assertCompleteRelease(entry);
    return entry;
}

export function createReleaseDraft(version) {
    if (!isSemver(version)) {
        throw new Error('release draft version must be SemVer');
    }

    return {
        version,
        date: null,
        targets: {
            server: undecidedReleaseTarget,
            app: undecidedReleaseTarget,
            ios: undecidedReleaseTarget,
            computer: undecidedReleaseTarget,
            agent: undecidedReleaseTarget,
        },
    };
}

export function appendReleaseDraft(value, version) {
    assertReleaseLedger(value, { requireComplete: true });
    if (!isSemver(version)) {
        throw new Error('release draft version must be SemVer');
    }
    const previousVersion = latestProductVersion(value);
    if (previousVersion && compareVersions(version, previousVersion) <= 0) {
        throw new Error(
            `release draft version ${version} must be greater than latest Grotto version ${previousVersion}`
        );
    }

    return [...value, createReleaseDraft(version)];
}

export function latestProductVersion(value) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
        const version = value[index]?.version;
        if (version) {
            return version;
        }
    }

    return null;
}

export function latestTargetVersion(value, targetName) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
        const version = releaseTargetVersion(value[index], targetName);
        if (version) {
            return version;
        }
    }
    return null;
}

export function isDraftRelease(entry) {
    return (
        entry?.date === null ||
        Object.values(entry?.targets ?? {}).some((target) => target === undecidedReleaseTarget)
    );
}

export function releasePublishesTarget(entry, targetName) {
    return isPublishedTarget(entry?.targets?.[targetName]);
}

export function releaseTargetVersion(entry, targetName) {
    const target = entry?.targets?.[targetName];
    if (!isPublishedTarget(target)) {
        return null;
    }

    return targetName === 'ios' ? target.version : target;
}

export function releaseTargetBuildNumber(entry) {
    const target = entry?.targets?.ios;
    return isPublishedTarget(target) ? target.buildNumber : null;
}

export function formatReleaseTargets(entry) {
    return [
        '### Release targets',
        '',
        ...releaseTargetNames.map((targetName) => {
            const target = entry.targets[targetName];
            if (target === undecidedReleaseTarget) {
                return `- ${targetLabels[targetName]}: Undecided`;
            }
            if (!isPublishedTarget(target)) {
                return `- ${targetLabels[targetName]}: Unchanged`;
            }

            const version = releaseTargetVersion(entry, targetName);
            const build = targetName === 'ios' ? ` (build ${releaseTargetBuildNumber(entry)})` : '';
            return `- ${targetLabels[targetName]}: Publish v${version}${build}`;
        }),
    ].join('\n');
}

function assertReleaseEntry(
    entry,
    { allowLegacyVersionless = false, allowUndecided = false } = {}
) {
    assertExactObject(entry, ['version', 'date', 'targets']);
    if (!(isSemver(entry.version) || (allowLegacyVersionless && entry.version === null))) {
        throw new Error('release ledger Grotto version must be SemVer');
    }
    if (entry.date !== null && !/^\d{4}-\d{2}-\d{2}$/u.test(entry.date)) {
        throw new Error('release ledger date must be YYYY-MM-DD or null');
    }
    assertTargets(entry.targets, allowUndecided);
}

function assertTargets(targets, allowUndecided) {
    if (!(targets && typeof targets === 'object' && !Array.isArray(targets))) {
        throw new Error('release ledger targets are invalid');
    }

    const targetNames = Object.keys(targets);
    const legacyTargetNames = releaseTargetNames.filter((targetName) => targetName !== 'agent');
    const isCurrent =
        targetNames.length === releaseTargetNames.length &&
        releaseTargetNames.every((targetName) => Object.hasOwn(targets, targetName));
    const isLegacy =
        targetNames.length === legacyTargetNames.length &&
        legacyTargetNames.every((targetName) => Object.hasOwn(targets, targetName));
    if (!(isCurrent || isLegacy)) {
        throw new Error(
            'release ledger targets must contain exactly Server, App, iOS, Computer, and Grotto Agent'
        );
    }

    for (const targetName of isCurrent ? releaseTargetNames : legacyTargetNames) {
        const target = targets[targetName];
        if (target === null) {
            continue;
        }
        if (target === undecidedReleaseTarget) {
            if (!allowUndecided) {
                throw new Error(`${targetLabels[targetName]} cannot remain undecided`);
            }
            continue;
        }
        if (targetName === 'ios') {
            assertExactObject(target, ['buildNumber', 'version']);
            if (!isSemver(target.version)) {
                throw new Error('iOS release target version must be SemVer');
            }
            if (!isBuildNumber(target.buildNumber)) {
                throw new Error('iOS release target requires a positive integer buildNumber');
            }
        } else if (!isSemver(target)) {
            throw new Error(`${targetLabels[targetName]} release target must be SemVer`);
        }
    }
}

function assertCompleteRelease(entry) {
    if (entry.date === null) {
        throw new Error('complete release ledger entry requires a date');
    }

    const publishedTargets = releaseTargetNames.filter((targetName) =>
        releasePublishesTarget(entry, targetName)
    );
    if (publishedTargets.length === 0) {
        throw new Error('complete release ledger entry must publish at least one target');
    }

    if (
        releasePublishesTarget(entry, 'agent') &&
        !(releasePublishesTarget(entry, 'server') && releasePublishesTarget(entry, 'computer'))
    ) {
        throw new Error('Grotto Agent publication requires Server and Computer publication');
    }
}

function isPublishedTarget(target) {
    return target !== undefined && target !== null && target !== undecidedReleaseTarget;
}

function isBuildNumber(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function assertExactObject(value, keys) {
    if (!(value && typeof value === 'object' && !Array.isArray(value))) {
        throw new Error('release ledger entry is invalid');
    }
    const actual = Object.keys(value);
    if (actual.length !== keys.length || !keys.every((key) => actual.includes(key))) {
        throw new Error('release ledger entry has unexpected fields');
    }
}
