import { cpSync, existsSync, rmSync } from 'node:fs';

export function syncOptionalAssetCatalog({ destinationPath, sourcePath }) {
    if (!existsSync(sourcePath)) {
        rmSync(destinationPath, { force: true });
        return false;
    }

    cpSync(sourcePath, destinationPath);
    return true;
}
