#!/usr/bin/env bun

import { verifyGrottoRelease } from '../apps/server/src/grotto-release-verification.ts';

const versionTagPattern = /^v(\d+\.\d+\.\d+)$/u;

export async function verifyInstalledGrottoServerRelease(args: string[]) {
    const [releaseRoot, versionTag, sourceRevision, ...extra] = args;
    const versionMatch = versionTag?.match(versionTagPattern);
    if (!(releaseRoot && versionMatch && sourceRevision && extra.length === 0)) {
        throw new Error('Usage: verify-grotto-server-release RELEASE_ROOT vX.Y.Z FULL_GIT_SHA');
    }

    const release = await verifyGrottoRelease(releaseRoot, sourceRevision);
    if (release.productVersion !== versionMatch[1]) {
        throw new Error('Grotto release product version does not match the published tag.');
    }
    return release;
}

if (import.meta.main) {
    const release = await verifyInstalledGrottoServerRelease(process.argv.slice(2));
    console.log(
        `Verified Grotto ${release.productVersion}, Server ${release.serverVersion}, at ${release.sourceRevision}.`
    );
}
