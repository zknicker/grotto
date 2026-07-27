import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function findGrottoServerReleaseAssets({ releaseRoot, sourceRevision, version }) {
    if (!/^[0-9a-f]{40}$/u.test(sourceRevision)) {
        throw new Error('Grotto Server release revision must be a full lowercase Git SHA.');
    }
    if (!/^\d+\.\d+\.\d+$/u.test(version)) {
        throw new Error('Grotto Server release version must be exact SemVer.');
    }

    const releaseId = `${version}+git.${sourceRevision.slice(0, 12)}`;
    const artifactName = `grotto-server-${releaseId}-aarch64-apple-darwin.tar.gz`;
    const artifactPath = path.join(releaseRoot, artifactName);
    const checksumPath = `${artifactPath}.sha256`;
    const checksum = await readFile(checksumPath, 'utf8');
    const match = checksum.match(/^([0-9a-f]{64}) {2}([^/\n]+)\n$/u);

    if (!(match && match[2] === artifactName)) {
        throw new Error('Grotto Server release checksum file is invalid.');
    }
    if ((await sha256(artifactPath)) !== match[1]) {
        throw new Error('Grotto Server release checksum does not match.');
    }

    return [artifactPath, checksumPath];
}

async function sha256(filePath) {
    const hash = createHash('sha256');
    await new Promise((resolve, reject) => {
        createReadStream(filePath)
            .on('data', (chunk) => hash.update(chunk))
            .on('error', reject)
            .on('end', resolve);
    });
    return hash.digest('hex');
}
