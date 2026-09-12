#!/usr/bin/env bun

import { verifyHausRelease } from '../apps/server/src/haus-release-verification.ts';

const versionTagPattern = /^v(\d+\.\d+\.\d+)$/u;

export async function verifyInstalledHausServerRelease(args: string[]) {
    const [releaseRoot, versionTag, sourceRevision, ...extra] = args;
    const versionMatch = versionTag?.match(versionTagPattern);
    if (!(releaseRoot && versionMatch && sourceRevision && extra.length === 0)) {
        throw new Error('Usage: verify-haus-server-release RELEASE_ROOT vX.Y.Z FULL_GIT_SHA');
    }

    const release = await verifyHausRelease(releaseRoot, sourceRevision);
    if (release.productVersion !== versionMatch[1]) {
        throw new Error('Haus release product version does not match the published tag.');
    }
    return release;
}

if (import.meta.main) {
    const release = await verifyInstalledHausServerRelease(process.argv.slice(2));
    console.log(
        `Verified Haus ${release.productVersion}, Server ${release.serverVersion}, at ${release.sourceRevision}.`
    );
}
