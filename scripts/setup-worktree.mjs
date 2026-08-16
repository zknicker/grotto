import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasHeroUiArtifacts, heroUiPackageRoot } from './heroui-artifacts.mjs';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const heroUiRoot = heroUiPackageRoot(repositoryRoot);

run('bun', ['install', '--frozen-lockfile'], repositoryRoot);

if (hasHeroUiArtifacts(heroUiRoot)) {
    console.log('HeroUI React Pro is ready.');
    process.exit(0);
}

const postinstall = join(heroUiRoot, 'dist/postinstall/index.js');
if (!existsSync(postinstall)) {
    fail(
        'HeroUI React Pro bootstrap package is missing. Run this setup again after checking Bun registry access.'
    );
}

console.log('Downloading the pinned HeroUI React Pro artifacts...');
run(process.execPath, [postinstall], heroUiRoot);

if (!hasHeroUiArtifacts(heroUiRoot)) {
    fail(
        'HeroUI React Pro authentication is required. Run `bunx heroui-pro@latest login`, then `bun run setup:worktree` again. CI must provide HEROUI_AUTH_TOKEN.'
    );
}

// A dev server started before this download caches a broken resolution for
// @heroui-pro/react, and that cache outlives a restart. Drop it with the fix.
rmSync(join(repositoryRoot, 'apps/website/node_modules/.vite'), {
    force: true,
    recursive: true,
});

console.log('HeroUI React Pro is ready.');

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
