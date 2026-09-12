import { readFileSync } from 'node:fs';

export interface HausReleaseIdentity {
    contentDigest: string;
    productVersion: string;
    releaseId: string;
    serverVersion: string;
    sourceRevision: string;
}

export function readHausReleaseIdentity(path: string): HausReleaseIdentity {
    const stored = JSON.parse(readFileSync(path, 'utf8')) as HausReleaseIdentity & {
        serverVersion?: string;
    };
    const release = { ...stored, serverVersion: stored.serverVersion ?? stored.productVersion };
    if (
        !(
            /^\d+\.\d+\.\d+$/u.test(release.productVersion) &&
            /^\d+\.\d+\.\d+$/u.test(release.serverVersion) &&
            /^[0-9a-f]{40}$/u.test(release.sourceRevision)
        ) ||
        release.releaseId !==
            `${release.serverVersion}+git.${release.sourceRevision.slice(0, 12)}` ||
        !/^[0-9a-f]{64}$/u.test(release.contentDigest)
    ) {
        throw new Error('Haus release identity is invalid.');
    }
    return release;
}
