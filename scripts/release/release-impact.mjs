import {
    assertReleaseLedger,
    releasePublishesTarget,
    releaseTargetVersion,
} from './release-ledger.mjs';
import { runGit } from './release-utils.mjs';

export const releaseImpactTargets = ['server', 'app', 'ios', 'computer'];

const requiredPrefixes = {
    server: [
        'apps/server/src/',
        'apps/server/drizzle/',
        'apps/server/operations/',
        'apps/server/host-services/',
        'apps/server/launchd/',
        'apps/website/src/',
        'apps/website/public/',
        'packages/agent-manual/src/',
    ],
    app: ['apps/website/electron/'],
    ios: ['apps/ios-swift/Sources/', 'apps/ios-swift/Config/', 'apps/ios-swift/Package.swift'],
    computer: [
        'apps/computer/src/',
        'apps/computer/package.json',
        'packages/agent-manual/src/',
        'packages/agent-manual/package.json',
        'packages/agent-workspace/src/',
        'packages/agent-workspace/package.json',
        'packages/claude-usage/src/',
        'packages/claude-usage/package.json',
        'packages/codex-usage/src/',
        'packages/codex-usage/package.json',
    ],
};

const reviewPrefixes = {
    server: [
        'packages/grotto-api/',
        'packages/agent-manual/package.json',
        'apps/server/package.json',
        'apps/website/package.json',
        'bun.lock',
        'package.json',
        'patches/',
    ],
    app: [
        'packages/grotto-api/',
        'apps/website/electron-builder.config.cjs',
        'apps/website/package.json',
        'bun.lock',
        'package.json',
        'patches/',
    ],
    ios: [
        'packages/grotto-api/',
        'apps/ios-swift/project.yml',
        'apps/ios-swift/Grotto.xcodeproj/project.pbxproj',
    ],
    computer: ['packages/grotto-api/', 'bun.lock', 'package.json', 'patches/'],
};

export async function calculateReleaseImpact({
    ledger,
    candidateRef = 'HEAD',
    resolveTag = resolveGitTag,
    resolveReleaseCommit = resolveRecordedReleaseCommit,
    listChangedFiles = readChangedFiles,
}) {
    assertReleaseLedger(ledger);
    const targets = {};
    for (const target of releaseImpactTargets) {
        const baseline = await findReleaseBaseline({
            ledger,
            target,
            resolveTag,
            resolveReleaseCommit,
        });
        const changedFiles = await listChangedFiles(baseline.sourceRevision, candidateRef);
        const requiredFiles = changedFiles.filter((file) => isRequiredFile(target, file));
        const reviewFiles = changedFiles.filter(
            (file) => !requiredFiles.includes(file) && isReviewFile(target, file)
        );
        targets[target] = {
            baseline,
            status:
                requiredFiles.length > 0
                    ? 'required'
                    : reviewFiles.length > 0
                      ? 'review'
                      : 'unchanged',
            requiredFiles,
            reviewFiles,
        };
    }
    return { candidateRef, targets };
}

export function assertRequiredTargetsSelected({ impact, selectedTargets }) {
    const missing = releaseImpactTargets.filter(
        (target) => impact.targets[target].status === 'required' && !selectedTargets[target]
    );
    if (missing.length === 0) {
        return;
    }
    const evidence = missing
        .map((target) => `${target}: ${impact.targets[target].requiredFiles.join(', ')}`)
        .join('\n');
    throw new Error(`releases.json marks changed release targets unchanged:\n${evidence}`);
}

export function formatReleaseImpact(impact) {
    const lines = ['## Release target impact', ''];
    for (const target of releaseImpactTargets) {
        const result = impact.targets[target];
        lines.push(`### ${targetLabel(target)} — ${statusLabel(result.status)}`);
        lines.push('');
        lines.push(`- Baseline: ${result.baseline.tag} (${result.baseline.sourceRevision})`);
        for (const file of result.requiredFiles) {
            lines.push(`- Required: ${file}`);
        }
        for (const file of result.reviewFiles) {
            lines.push(`- Review: ${file}`);
        }
        if (result.status === 'unchanged') {
            lines.push('- No owned shipping inputs changed.');
        }
        lines.push('');
    }
    return lines.join('\n').trimEnd();
}

async function findReleaseBaseline({ ledger, target, resolveTag, resolveReleaseCommit }) {
    for (let index = ledger.length - 1; index >= 0; index -= 1) {
        const entry = ledger[index];
        if (!releasePublishesTarget(entry, target)) {
            continue;
        }
        const tag = targetTag(entry, target);
        if (!tag) {
            continue;
        }
        const sourceRevision = await resolveTag(tag);
        if (sourceRevision) {
            return { tag, sourceRevision };
        }
        if (target !== 'computer' && index < ledger.length - 1 && entry.version) {
            const recordedRevision = await resolveReleaseCommit(entry.version);
            if (recordedRevision) {
                return { tag: `release:v${entry.version}`, sourceRevision: recordedRevision };
            }
        }
    }
    throw new Error(`could not resolve a recorded ${target} release source`);
}

function targetTag(entry, target) {
    if (target === 'computer') {
        const version = releaseTargetVersion(entry, target);
        return version ? `computer-v${version}` : null;
    }
    return entry.version ? `v${entry.version}` : null;
}

async function resolveGitTag(tag) {
    try {
        const { stdout } = await runGit(['rev-parse', '--verify', `${tag}^{commit}`]);
        const revision = stdout.trim();
        return /^[0-9a-f]{40}$/u.test(revision) ? revision : null;
    } catch {
        return null;
    }
}

async function resolveRecordedReleaseCommit(version) {
    const { stdout } = await runGit([
        'log',
        '--format=%H',
        '--extended-regexp',
        '--grep',
        `^release: v${version}( |$)`,
        '-n',
        '1',
    ]);
    const revision = stdout.trim();
    return /^[0-9a-f]{40}$/u.test(revision) ? revision : null;
}

async function readChangedFiles(before, after) {
    const { stdout } = await runGit([
        'diff',
        '--name-only',
        '--diff-filter=ACDMRTUXB',
        `${before}..${after}`,
        '--',
    ]);
    return stdout
        .split('\n')
        .map((file) => file.trim())
        .filter(Boolean);
}

function isRequiredFile(target, file) {
    if (isNonShippingFile(file)) {
        return false;
    }
    return requiredPrefixes[target].some((prefix) => matchesPath(file, prefix));
}

function isReviewFile(target, file) {
    if (isNonShippingFile(file)) {
        return false;
    }
    return reviewPrefixes[target].some((prefix) => matchesPath(file, prefix));
}

function isNonShippingFile(file) {
    return (
        /(^|\/)(test|tests|e2e|fixtures|__snapshots__)(\/|$)/u.test(file) ||
        /\.test\.[^/]+$/u.test(file) ||
        /(^|\/)README\.md$/u.test(file) ||
        file.startsWith('docs/') ||
        file.startsWith('specs/') ||
        file.startsWith('.agents/') ||
        file.startsWith('.github/')
    );
}

function matchesPath(file, prefix) {
    return prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix;
}

function targetLabel(target) {
    return { server: 'Server', app: 'App', ios: 'iOS', computer: 'Computer' }[target];
}

function statusLabel(status) {
    return { required: 'publish required', review: 'agent review', unchanged: 'unchanged' }[status];
}
