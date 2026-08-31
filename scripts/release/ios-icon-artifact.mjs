import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
export const iosIconArtifactFiles = [
    'Assets.car',
    'assetcatalog_generated_info.plist',
    'mac-icon60x60@2x.png',
    'mac-icon76x76@2x~ipad.png',
];

export function assertIOSIconArtifact(directory) {
    for (const file of iosIconArtifactFiles) {
        if (!existsSync(path.join(directory, file))) {
            throw new Error(`compiled iOS icon artifact is missing ${file}`);
        }
    }
}

export function inspectIOSIconArtifact(directory) {
    assertIOSIconArtifact(directory);
    const result = spawnSync('xcrun', ['assetutil', '--info', path.join(directory, 'Assets.car')], {
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        throw new Error(
            `assetutil failed to inspect the compiled iOS icon: ${result.stderr.trim()}`
        );
    }
    assertIOSIconRenditions(JSON.parse(result.stdout));
}

export function assertInstalledIOSIcon({ appDirectory, artifactDirectory }) {
    assertIOSIconArtifact(artifactDirectory);
    for (const file of ['Assets.car', 'mac-icon60x60@2x.png', 'mac-icon76x76@2x~ipad.png']) {
        const installedPath = path.join(appDirectory, file);
        if (!existsSync(installedPath)) {
            throw new Error(`archived iOS app is missing ${file}`);
        }
        if (!readFileSync(installedPath).equals(readFileSync(path.join(artifactDirectory, file)))) {
            throw new Error(`archived iOS app does not contain the prepared ${file}`);
        }
    }

    const plist = spawnSync(
        'plutil',
        ['-convert', 'json', '-o', '-', path.join(appDirectory, 'Info.plist')],
        { encoding: 'utf8' }
    );
    if (plist.status !== 0) {
        throw new Error(`plutil failed to inspect the archived app: ${plist.stderr.trim()}`);
    }
    const info = JSON.parse(plist.stdout);
    if (info.CFBundleIcons?.CFBundlePrimaryIcon?.CFBundleIconName !== 'mac-icon') {
        throw new Error('archived iOS app is missing the mac-icon bundle metadata');
    }
}

export function assertIOSIconRenditions(renditions) {
    if (!Array.isArray(renditions)) {
        throw new Error('compiled iOS icon metadata must be an array');
    }

    const stacks = renditions.filter(
        (rendition) => rendition.AssetType === 'IconImageStack' && rendition.Name === 'mac-icon'
    );
    const appearances = new Set(stacks.map((rendition) => rendition.Appearance));
    for (const appearance of ['UIAppearanceLight', 'UIAppearanceDark', 'ISAppearanceTintable']) {
        if (!appearances.has(appearance)) {
            throw new Error(`compiled iOS icon is missing its ${appearance} icon stack`);
        }
    }

    const layers = stacks.flatMap((rendition) => rendition.Layers ?? []);
    if (!layers.some((layer) => layer.LayerHasSpecular === true)) {
        throw new Error('compiled iOS icon lost its specular layers');
    }
    if (!layers.some((layer) => Number(layer.LayerRefractionStrength) > 0)) {
        throw new Error('compiled iOS icon lost its refractive layers');
    }

    const marketingIcons = renditions.filter(
        (rendition) =>
            rendition.AssetType === 'Icon Image' &&
            rendition.Name === 'mac-icon' &&
            rendition.Idiom === 'phone' &&
            rendition.PixelWidth === 1024 &&
            rendition.PixelHeight === 1024
    );
    const marketingAppearances = new Set(
        marketingIcons.map((rendition) => rendition.Appearance ?? 'UIAppearanceAny')
    );
    for (const appearance of ['UIAppearanceAny', 'UIAppearanceDark', 'ISAppearanceTintable']) {
        if (!marketingAppearances.has(appearance)) {
            throw new Error(`compiled iOS icon is missing its ${appearance} 1024px rendition`);
        }
    }
}
