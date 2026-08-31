import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { selectCompiledIcon, syncOptionalAssetCatalog } from './macos-app-icon.mjs';

const temporaryDirectories = [];

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        rmSync(directory, { force: true, recursive: true });
    }
});

describe('syncOptionalAssetCatalog', () => {
    test('removes a stale catalog when actool emits only an ICNS file', () => {
        const directory = makeTemporaryDirectory();
        const destinationPath = path.join(directory, 'Assets.car');
        writeFileSync(destinationPath, 'stale');

        expect(
            syncOptionalAssetCatalog({
                destinationPath,
                sourcePath: path.join(directory, 'missing.car'),
            })
        ).toBe(false);
        expect(existsSync(destinationPath)).toBe(false);
    });

    test('copies the catalog when actool emits one', () => {
        const directory = makeTemporaryDirectory();
        const sourcePath = path.join(directory, 'compiled.car');
        const destinationPath = path.join(directory, 'Assets.car');
        writeFileSync(sourcePath, 'compiled');

        expect(syncOptionalAssetCatalog({ destinationPath, sourcePath })).toBe(true);
        expect(readFileSync(destinationPath, 'utf8')).toBe('compiled');
    });
});

describe('selectCompiledIcon', () => {
    test('uses the checked-in fallback when actool emits no ICNS file', () => {
        const directory = makeTemporaryDirectory();
        const fallbackIconPath = path.join(directory, 'fallback.icns');
        writeFileSync(fallbackIconPath, 'fallback');

        expect(
            selectCompiledIcon({
                compiledIconPath: path.join(directory, 'missing.icns'),
                fallbackIconPath,
            })
        ).toEqual({ kind: 'fallback', path: fallbackIconPath });
    });

    test('prefers actool output when the installed Xcode supports Icon Composer sources', () => {
        const directory = makeTemporaryDirectory();
        const compiledIconPath = path.join(directory, 'compiled.icns');
        const fallbackIconPath = path.join(directory, 'fallback.icns');
        writeFileSync(compiledIconPath, 'compiled');
        writeFileSync(fallbackIconPath, 'fallback');

        expect(selectCompiledIcon({ compiledIconPath, fallbackIconPath })).toEqual({
            kind: 'compiled',
            path: compiledIconPath,
        });
    });

    test('fails explicitly when neither icon representation exists', () => {
        const directory = makeTemporaryDirectory();

        expect(() =>
            selectCompiledIcon({
                compiledIconPath: path.join(directory, 'missing.icns'),
                fallbackIconPath: path.join(directory, 'missing-fallback.icns'),
            })
        ).toThrow('actool emitted no ICNS file and the checked-in fallback is missing');
    });
});

function makeTemporaryDirectory() {
    const directory = mkdtempSync(path.join(tmpdir(), 'grotto-icon-test-'));
    temporaryDirectories.push(directory);
    return directory;
}
