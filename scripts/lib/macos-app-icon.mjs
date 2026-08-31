import { cpSync, existsSync, rmSync } from 'node:fs';

export function requireCompiledIcon(compiledIconPath) {
    if (!existsSync(compiledIconPath)) {
        throw new Error(
            'actool emitted no ICNS file; Xcode 27 or newer is required to compile Icon Composer sources'
        );
    }
}

export function syncOptionalAssetCatalog({ destinationPath, sourcePath }) {
    if (!existsSync(sourcePath)) {
        rmSync(destinationPath, { force: true });
        return false;
    }

    cpSync(sourcePath, destinationPath);
    return true;
}
