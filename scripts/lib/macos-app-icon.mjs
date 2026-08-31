import { cpSync, existsSync, rmSync } from 'node:fs';

export function selectCompiledIcon({ compiledIconPath, fallbackIconPath }) {
    if (existsSync(compiledIconPath)) {
        return { kind: 'compiled', path: compiledIconPath };
    }
    if (existsSync(fallbackIconPath)) {
        return { kind: 'fallback', path: fallbackIconPath };
    }

    throw new Error('actool emitted no ICNS file and the checked-in fallback is missing');
}

export function syncOptionalAssetCatalog({ destinationPath, sourcePath }) {
    if (!existsSync(sourcePath)) {
        rmSync(destinationPath, { force: true });
        return false;
    }

    cpSync(sourcePath, destinationPath);
    return true;
}
