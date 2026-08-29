import { afterEach, expect, test } from 'bun:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const releaseScriptRoot = fileURLToPath(new URL('.', import.meta.url));
const temporaryRoots = [];

afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

test('appends the Grotto draft without changing component versions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-release-bump-'));
    temporaryRoots.push(root);
    await Promise.all(
        [
            'apps/computer',
            'apps/website',
            'apps/ios-swift/Grotto.xcodeproj',
            'packages/grotto-api',
            'scripts/release',
        ].map((directory) => mkdir(join(root, directory), { recursive: true }))
    );
    await Promise.all(
        [
            'bump-version.mjs',
            'release-ledger.mjs',
            'release-utils.mjs',
            'release-version-metadata.mjs',
        ].map((file) =>
            copyFile(join(releaseScriptRoot, file), join(root, 'scripts/release', file))
        )
    );
    await writeFile(join(root, 'apps/website/package.json'), '{"version":"1.8.19"}\n');
    await writeFile(join(root, 'apps/computer/package.json'), '{"version":"1.4.8"}\n');
    await writeFile(
        join(root, 'apps/ios-swift/project.yml'),
        'settings:\n  base:\n    CURRENT_PROJECT_VERSION: "1"\n    MARKETING_VERSION: 1.8.19\n'
    );
    await writeFile(
        join(root, 'apps/ios-swift/Grotto.xcodeproj/project.pbxproj'),
        'Debug { CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1.8.19; }\nRelease { CURRENT_PROJECT_VERSION = 1; MARKETING_VERSION = 1.8.19; }\n'
    );
    await writeFile(join(root, 'CHANGELOG.md'), '## v1.8.19 - 2026-08-19\n');
    await writeFile(join(root, 'packages/grotto-api/grotto-agent.json'), '{"version":"1.0.0"}\n');
    await writeFile(
        join(root, 'packages/grotto-api/grotto-product.json'),
        '{"version":"1.8.19"}\n'
    );
    await writeFile(
        join(root, 'bun.lock'),
        '{\n  "workspaces": {\n    "apps/computer": {\n      "name": "@grotto/computer",\n      "version": "1.4.8",\n    },\n    "apps/website": {\n      "name": "@grotto/website",\n      "version": "1.8.19",\n    },\n  },\n}\n'
    );
    const originalLedger = `${JSON.stringify(
        [
            {
                version: '1.8.19',
                date: '2026-08-19',
                targets: {
                    server: '1.8.19',
                    app: null,
                    ios: { version: '1.0.5', buildNumber: 6 },
                    computer: '1.4.8',
                    agent: '1.0.0',
                },
            },
        ],
        null,
        2
    )}\n`;
    await writeFile(join(root, 'releases.json'), originalLedger);

    const result = Bun.spawnSync(
        ['node', join(root, 'scripts/release/bump-version.mjs'), 'patch'],
        { cwd: root, stderr: 'pipe', stdout: 'pipe' }
    );

    expect(result.stderr.toString()).toBe('');
    expect(result.exitCode).toBe(0);
    expect(
        JSON.parse(await readFile(join(root, 'apps/website/package.json'), 'utf8')).version
    ).toBe('1.8.19');
    expect(
        JSON.parse(await readFile(join(root, 'packages/grotto-api/grotto-product.json'), 'utf8'))
            .version
    ).toBe('1.8.20');
    expect(await readFile(join(root, 'apps/ios-swift/project.yml'), 'utf8')).toContain(
        'CURRENT_PROJECT_VERSION: "6"'
    );
    expect(await readFile(join(root, 'apps/ios-swift/project.yml'), 'utf8')).toContain(
        'MARKETING_VERSION: 1.0.5'
    );
    expect(
        await readFile(join(root, 'apps/ios-swift/Grotto.xcodeproj/project.pbxproj'), 'utf8')
    ).toBe(
        'Debug { CURRENT_PROJECT_VERSION = 6; MARKETING_VERSION = 1.0.5; }\nRelease { CURRENT_PROJECT_VERSION = 6; MARKETING_VERSION = 1.0.5; }\n'
    );
    expect(await readFile(join(root, 'bun.lock'), 'utf8')).toContain('"version": "1.8.19"');
    const updatedLedger = await readFile(join(root, 'releases.json'), 'utf8');
    expect(updatedLedger.startsWith(originalLedger.replace(/\n\]\n$/u, ''))).toBe(true);
    expect(JSON.parse(updatedLedger).at(-1)).toEqual({
        version: '1.8.20',
        date: null,
        targets: {
            server: 'undecided',
            app: 'undecided',
            ios: 'undecided',
            computer: 'undecided',
            agent: 'undecided',
        },
    });
});
