#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const releaseRoot = path.join(repoRoot, 'apps', 'server', 'release');
const stageRoot = path.join(releaseRoot, 'stage');
if (!process.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()) {
    throw new Error('VITE_CLERK_PUBLISHABLE_KEY is required for the hosted App artifact.');
}
const sourceRevision = process.env.GROTTO_SOURCE_REVISION?.trim() ?? '';
if (!/^[0-9a-f]{40}$/.test(sourceRevision)) {
    throw new Error('GROTTO_SOURCE_REVISION must be a full lowercase Git commit SHA.');
}
const websitePackage = JSON.parse(
    await fs.readFile(path.join(repoRoot, 'apps', 'website', 'package.json'), 'utf8')
);
const releaseId = `${websitePackage.version}+git.${sourceRevision.slice(0, 12)}`;
const artifactName = `grotto-server-${releaseId}-aarch64-apple-darwin.tar.gz`;
const artifactPath = path.join(releaseRoot, artifactName);

await fs.rm(releaseRoot, { force: true, recursive: true });
await fs.mkdir(path.join(stageRoot, 'bin'), { recursive: true });

const binaries = [
    ['activate-grotto-server', 'grotto-server-activation.ts'],
    ['grotto-server', 'grotto-server.ts'],
    ['grotto-server-bootstrap', 'grotto-server-bootstrap.ts'],
    ['grotto-server-backup', 'grotto-server-backup.ts'],
    ['grotto-server-restore', 'grotto-server-restore.ts'],
];
for (const [name, source] of binaries) {
    run('bun', [
        'build',
        `apps/server/src/${source}`,
        '--compile',
        '--compile-autoload-package-json',
        '--outfile',
        path.join(stageRoot, 'bin', name),
    ]);
}
run('bun', [
    'build',
    'scripts/deploy-grotto-server.ts',
    '--compile',
    '--compile-autoload-package-json',
    '--outfile',
    path.join(stageRoot, 'bin', 'grotto-server-deploy'),
]);

run(
    'bun',
    ['x', 'vite', 'build', '--outDir', path.join(stageRoot, 'share', 'grotto-server', 'app')],
    {
        cwd: path.join(repoRoot, 'apps', 'website'),
        env: { ...process.env, TAVERN_HOSTED_APP: '1' },
    }
);

await fs.cp(path.join(repoRoot, 'apps', 'server', 'launchd'), path.join(stageRoot, 'launchd'), {
    recursive: true,
});
await fs.cp(
    path.join(repoRoot, 'apps', 'server', 'host-services'),
    path.join(stageRoot, 'host-services'),
    { recursive: true }
);
await fs.cp(path.join(repoRoot, 'apps', 'server', 'colima'), path.join(stageRoot, 'colima'), {
    recursive: true,
});
await fs.copyFile(
    path.join(repoRoot, 'apps', 'server', 'compose.yml'),
    path.join(stageRoot, 'compose.yml')
);
await fs.cp(path.join(repoRoot, 'apps', 'server', 'config'), path.join(stageRoot, 'config'), {
    recursive: true,
});
await fs.cp(
    path.join(repoRoot, 'apps', 'server', 'operations'),
    path.join(stageRoot, 'operations'),
    { recursive: true }
);
for (const operation of [
    'install-colima-boot',
    'rollback-colima-boot',
    'run-server',
    'run-backup',
    'run-restore',
]) {
    await fs.chmod(path.join(stageRoot, 'operations', operation), 0o755);
}

const contentDigest = await writeReleaseChecksums(stageRoot);
await fs.writeFile(
    path.join(stageRoot, 'release.json'),
    `${JSON.stringify(
        {
            contentDigest,
            productVersion: websitePackage.version,
            releaseId,
            sourceRevision,
        },
        null,
        2
    )}\n`
);

await fs.mkdir(releaseRoot, { recursive: true });
run('tar', ['-czf', artifactPath, '-C', stageRoot, '.']);
await fs.writeFile(`${artifactPath}.sha256`, `${await sha256(artifactPath)}  ${artifactName}\n`);
console.log(`Built ${path.relative(repoRoot, artifactPath)}`);

function run(command, args, options = {}) {
    execFileSync(command, args, {
        cwd: options.cwd ?? repoRoot,
        env: options.env ?? process.env,
        stdio: 'inherit',
    });
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

async function writeReleaseChecksums(root) {
    const files = await listFiles(root);
    const checksumPath = path.join(root, 'release-files.sha256');
    const lines = [];

    for (const relativePath of files) {
        lines.push(`${await sha256(path.join(root, relativePath))}  ./${relativePath}\n`);
    }

    await fs.writeFile(checksumPath, lines.join(''));
    return await sha256(checksumPath);
}

async function listFiles(root, relativeRoot = '') {
    const directory = path.join(root, relativeRoot);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const relativePath = path.posix.join(relativeRoot, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await listFiles(root, relativePath)));
        } else if (entry.isFile()) {
            files.push(relativePath);
        } else {
            throw new Error(`Unsupported release entry: ${relativePath}`);
        }
    }

    return files.sort();
}
