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
const websitePackage = JSON.parse(
    await fs.readFile(path.join(repoRoot, 'apps', 'website', 'package.json'), 'utf8')
);
const artifactName = `grotto-server-${websitePackage.version}-aarch64-apple-darwin.tar.gz`;
const artifactPath = path.join(releaseRoot, artifactName);

await fs.rm(releaseRoot, { force: true, recursive: true });
await fs.mkdir(path.join(stageRoot, 'bin'), { recursive: true });

const binaries = [
    ['grotto-server', 'grotto-server.ts'],
    ['grotto-server-bootstrap', 'grotto-server-bootstrap.ts'],
    ['grotto-server-backup', 'grotto-server-backup.ts'],
    ['grotto-server-restore', 'grotto-server-restore.ts'],
    ['grotto-server-monitor', 'grotto-server-monitor.ts'],
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
await fs.cp(path.join(repoRoot, 'apps', 'server', 'config'), path.join(stageRoot, 'config'), {
    recursive: true,
});
await fs.cp(
    path.join(repoRoot, 'apps', 'server', 'operations'),
    path.join(stageRoot, 'operations'),
    { recursive: true }
);
for (const operation of ['run-server', 'run-backup', 'run-monitor', 'run-restore']) {
    await fs.chmod(path.join(stageRoot, 'operations', operation), 0o755);
}

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
