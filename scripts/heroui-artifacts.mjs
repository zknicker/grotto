// HeroUI React Pro ships a bootstrap package; the real dist is downloaded by a
// postinstall step that bunfig.toml's `ignoreScripts` suppresses. Worktree setup
// runs that step explicitly, so both setup and the dev stack need one shared
// answer to "are the artifacts actually here?".
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const HEROUI_PACKAGE_PATH = 'apps/website/node_modules/@heroui-pro/react';

const REQUIRED_ARTIFACTS = ['dist/index.d.ts', 'dist/index.js', 'dist/css/index.css'];

export function heroUiPackageRoot(repositoryRoot) {
    return join(repositoryRoot, HEROUI_PACKAGE_PATH);
}

export function hasHeroUiArtifacts(packageRoot) {
    return REQUIRED_ARTIFACTS.every((artifact) => existsSync(join(packageRoot, artifact)));
}
