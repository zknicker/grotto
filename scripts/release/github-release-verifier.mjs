export const APP_RELEASE_ASSETS = Object.freeze([
    'latest-mac.yml',
    'Grotto_{version}_arm64.dmg',
    'Grotto_{version}_arm64.zip',
    'Grotto_{version}_arm64.dmg.blockmap',
    'Grotto_{version}_arm64.zip.blockmap',
]);

const fullShaPattern = /^[0-9a-f]{40}$/u;
const semverPattern = /^\d+\.\d+\.\d+$/u;

export async function resolveTagCommit({ repository, tagName, ghApi }) {
    requireString(repository, 'GitHub repository');
    requireString(tagName, 'Git tag');
    const ref = await ghApi(`repos/${repository}/git/ref/tags/${tagName}`);
    const refObject = ref?.object;
    assertRecord(refObject, 'GitHub tag reference');
    const refType = refObject.type;
    const refSha = requireGitSha(refObject.sha, 'Git tag reference');
    if (refType === 'commit') {
        return refSha;
    }
    if (refType !== 'tag') {
        throw new Error(`tag ${tagName} has unsupported Git object type ${String(refType)}`);
    }
    const annotated = await ghApi(`repos/${repository}/git/tags/${refSha}`);
    const annotatedObject = annotated?.object;
    assertRecord(annotatedObject, 'annotated Git tag');
    if (annotatedObject.type !== 'commit') {
        throw new Error(`tag ${tagName} does not resolve directly to a commit`);
    }
    return requireGitSha(annotatedObject.sha, 'annotated Git tag');
}

export async function verifyNormalRelease({
    repository,
    sourceRevision,
    releaseVersion,
    publishApp,
    ghApi,
}) {
    requireGitSha(sourceRevision, 'release source revision');
    requireSemver(releaseVersion, 'release version');
    if (typeof publishApp !== 'boolean') {
        throw new Error('publishApp must be boolean');
    }
    const tagName = `v${releaseVersion}`;
    await verifyTag({ repository, tagName, sourceRevision, ghApi });
    const release = await ghApi(`repos/${repository}/releases/tags/${tagName}`);
    assertPublishedRelease(release, tagName);

    const requiredAssets = [
        serverAssetName(releaseVersion, sourceRevision),
        serverChecksumName(releaseVersion, sourceRevision),
    ];
    if (publishApp) {
        requiredAssets.push(
            ...APP_RELEASE_ASSETS.map((name) => name.replace('{version}', releaseVersion))
        );
    }
    for (const assetName of requiredAssets) {
        requireReleaseAsset(release, assetName);
    }
    return {
        mode: 'normal',
        message:
            'verified main tag ' +
            tagName +
            ', merged SHA, non-draft GitHub Release, and release assets',
        requiredAssets,
        tagName,
    };
}

function serverAssetName(version, sourceRevision) {
    return (
        'grotto-server-' +
        version +
        '+git.' +
        sourceRevision.slice(0, 12) +
        '-aarch64-apple-darwin.tar.gz'
    );
}

function serverChecksumName(version, sourceRevision) {
    return `${serverAssetName(version, sourceRevision)}.sha256`;
}

async function verifyTag({ repository, tagName, sourceRevision, ghApi }) {
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
}

function assertPublishedRelease(release, tagName) {
    assertRecord(release, `GitHub Release ${tagName}`);
    if (
        release.draft !== false ||
        release.prerelease !== false ||
        release.published_at == null ||
        !Array.isArray(release.assets) ||
        release.assets.length === 0
    ) {
        throw new Error(`GitHub Release ${tagName} is missing a published release or assets`);
    }
}

function requireReleaseAsset(release, assetName) {
    if (!release.assets.some((asset) => asset?.name === assetName)) {
        throw new Error(`GitHub Release is missing asset ${assetName}`);
    }
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

function requireString(value, label) {
    if (typeof value !== 'string' || !value) {
        throw new Error(`${label} is required`);
    }
}

function assertRecord(value, label) {
    if (!(value && typeof value === 'object' && !Array.isArray(value))) {
        throw new Error(`${label} must be an object`);
    }
}
