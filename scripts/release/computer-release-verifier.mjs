import { resolveTagCommit } from './github-release-verifier.mjs';

const fullShaPattern = /^[0-9a-f]{40}$/u;
const semverPattern = /^\d+\.\d+\.\d+$/u;

export async function verifyComputerOnlyRelease({
    repository,
    sourceRevision,
    computerVersion,
    ghApi,
    fetchImpl = fetch,
    descriptorUrl,
}) {
    requireGitSha(sourceRevision, 'release source revision');
    requireSemver(computerVersion, 'Computer version');
    const tagName = `computer-v${computerVersion}`;
    const resolved = await resolveTagCommit({ repository, tagName, ghApi });
    if (resolved !== sourceRevision) {
        throw new Error(
            'tag ' +
                tagName +
                ' resolves to ' +
                resolved +
                ', expected merged SHA ' +
                sourceRevision
        );
    }

    const url =
        descriptorUrl ?? `https://releases.grotto.sh/computer/${computerVersion}/release.json`;
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response || response.ok !== true) {
        throw new Error(
            `public Computer descriptor returned ${String(response?.status ?? 'an error')}`
        );
    }
    let descriptor;
    try {
        descriptor = await response.json();
    } catch {
        throw new Error('public Computer descriptor returned malformed JSON');
    }
    if (
        !(
            descriptor &&
            typeof descriptor === 'object' &&
            !Array.isArray(descriptor) &&
            descriptor.release &&
            typeof descriptor.release === 'object' &&
            !Array.isArray(descriptor.release)
        )
    ) {
        throw new Error('public Computer descriptor release must be an object');
    }
    if (
        descriptor.release.version !== computerVersion ||
        descriptor.release.sourceRevision !== sourceRevision ||
        typeof descriptor.signature !== 'string' ||
        descriptor.signature.length === 0
    ) {
        throw new Error(
            'public Computer descriptor does not match ' +
                tagName +
                ' and merged SHA ' +
                sourceRevision
        );
    }
    return {
        mode: 'computer-only',
        message: `verified Computer tag ${tagName}, merged SHA, and public descriptor`,
        tagName,
    };
}

function requireGitSha(value, label) {
    if (typeof value !== 'string' || !fullShaPattern.test(value)) {
        throw new Error(`${label} must be a full lowercase Git SHA`);
    }
    return value;
}

function requireSemver(value, label) {
    if (typeof value !== 'string' || !semverPattern.test(value)) {
        throw new Error(`${label} must be X.Y.Z`);
    }
    return value;
}
