import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectCompiledIcon, syncOptionalAssetCatalog } from './lib/macos-app-icon.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, '..');
const shouldUpdateFallback = process.argv.includes('--update-fallback');
const sourceIconPath = path.join(repositoryRoot, 'assets', 'mac-icon.icon');
const fallbackIconPath = path.join(repositoryRoot, 'assets', 'mac-icon-fallback.icns');
const iconsDirectory = path.join(repositoryRoot, 'apps', 'website', 'electron', 'icons');
const generatedIconsDirectory = path.join(
    repositoryRoot,
    'apps',
    'website',
    'electron',
    'generated-icons'
);

const stagedIconPath = path.join(
    mkdtempSync(path.join(tmpdir(), 'grotto-app-icon-')),
    'AppIcon.icon'
);
const outputDirectory = mkdtempSync(path.join(tmpdir(), 'grotto-app-icon-out-'));
const compiledIconPath = path.join(outputDirectory, 'AppIcon.icns');

if (!existsSync(sourceIconPath)) {
    throw new Error(`Missing Icon Composer source: ${sourceIconPath}`);
}

try {
    const actoolPath = execFileSync('/usr/bin/xcrun', ['-f', 'actool'], {
        encoding: 'utf8',
    }).trim();

    mkdirSync(generatedIconsDirectory, { recursive: true });
    mkdirSync(iconsDirectory, { recursive: true });
    cpSync(sourceIconPath, stagedIconPath, { recursive: true });
    execFileSync(
        actoolPath,
        [
            stagedIconPath,
            '--app-icon',
            'AppIcon',
            '--compile',
            outputDirectory,
            '--output-partial-info-plist',
            path.join(outputDirectory, 'assetcatalog_generated_info.plist'),
            '--minimum-deployment-target',
            '11.0',
            '--platform',
            'macosx',
            '--target-device',
            'mac',
        ],
        { stdio: 'pipe' }
    );

    const copiedAssetCatalog = syncOptionalAssetCatalog({
        destinationPath: path.join(generatedIconsDirectory, 'Assets.car'),
        sourcePath: path.join(outputDirectory, 'Assets.car'),
    });
    if (shouldUpdateFallback) {
        if (!existsSync(compiledIconPath)) {
            throw new Error('The installed Xcode cannot update the checked-in ICNS fallback');
        }
        cpSync(compiledIconPath, fallbackIconPath);
    }
    const selectedIcon = selectCompiledIcon({ compiledIconPath, fallbackIconPath });
    cpSync(selectedIcon.path, path.join(iconsDirectory, 'AppIcon.icns'));
    cpSync(selectedIcon.path, path.join(iconsDirectory, 'icon.icns'));
    execFileSync(
        '/usr/bin/sips',
        [
            '-s',
            'format',
            'png',
            selectedIcon.path,
            '--out',
            path.join(iconsDirectory, 'AppIcon.png'),
        ],
        { stdio: 'pipe' }
    );

    console.log(
        `[grotto] macOS app icon compiled from assets/mac-icon.icon (${copiedAssetCatalog ? 'Assets.car + ' : ''}${selectedIcon.kind === 'compiled' ? 'compiled ICNS' : 'fallback ICNS'})`
    );
} finally {
    rmSync(path.dirname(stagedIconPath), { recursive: true, force: true });
    rmSync(outputDirectory, { recursive: true, force: true });
}
