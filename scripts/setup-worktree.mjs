import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const heroUiPackageRoot = join(repositoryRoot, 'apps/website/node_modules/@heroui-pro/react');

run('bun', ['install', '--frozen-lockfile'], repositoryRoot);

if (hasHeroUiArtifacts(heroUiPackageRoot)) {
    console.log('HeroUI React Pro is ready.');
    process.exit(0);
}

const postinstall = join(heroUiPackageRoot, 'dist/postinstall/index.js');
if (!existsSync(postinstall)) {
    fail(
        'HeroUI React Pro bootstrap package is missing. Run this setup again after checking Bun registry access.'
    );
}

console.log('Downloading the pinned HeroUI React Pro artifacts...');
run(process.execPath, [postinstall], heroUiPackageRoot);

if (!hasHeroUiArtifacts(heroUiPackageRoot)) {
    fail(
        'HeroUI React Pro authentication is required. Run `bunx heroui-pro@latest login`, then `bun run setup:worktree` again. CI must provide HEROUI_AUTH_TOKEN.'
    );
}

console.log('HeroUI React Pro is ready.');

function hasHeroUiArtifacts(packageRoot) {
    return ['dist/index.d.ts', 'dist/index.js', 'dist/css/index.css'].every((path) =>
        existsSync(join(packageRoot, path))
    );
}

function run(command, args, cwd) {
    const result = spawnSync(command, args, {
        cwd,
        env: process.env,
        stdio: 'inherit',
    });
    if (result.error) {
        fail(result.error.message);
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function fail(message) {
    console.error(message);
    process.exit(1);
}
