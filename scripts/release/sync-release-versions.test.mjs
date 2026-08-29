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

test('synchronizes every target-owned version from the latest release decision', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-release-sync-'));
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
            'release-ledger.mjs',
            'release-utils.mjs',
            'release-version-metadata.mjs',
            'sync-release-versions.mjs',
        ].map((file) =>
            copyFile(join(releaseScriptRoot, file), join(root, 'scripts/release', file))
        )
    );
    await writeFile(join(root, 'apps/website/package.json'), '{"version":"0.0.1"}\n');
    await writeFile(join(root, 'apps/computer/package.json'), '{"version":"0.0.1"}\n');
    await writeFile(join(root, 'packages/grotto-api/grotto-agent.json'), '{"version":"0.0.1"}\n');
    await writeFile(join(root, 'packages/grotto-api/grotto-product.json'), '{"version":"0.0.1"}\n');
    await writeFile(
        join(root, 'apps/ios-swift/project.yml'),
        'CURRENT_PROJECT_VERSION: "1"\nMARKETING_VERSION: 0.0.1\n'
    );
    await writeFile(
        join(root, 'apps/ios-swift/Grotto.xcodeproj/project.pbxproj'),
        'CURRENT_PROJECT_VERSION = 1;\nMARKETING_VERSION = 0.0.1;\n'
    );
    await writeFile(
        join(root, 'bun.lock'),
        '{\n  "workspaces": {\n    "apps/computer": {\n      "version": "0.0.1",\n    },\n    "apps/website": {\n      "version": "0.0.1",\n    },\n  },\n}\n'
    );
    await writeFile(
        join(root, 'releases.json'),
        `${JSON.stringify(
            [
                {
                    version: '2.0.0',
                    date: '2026-08-28',
                    targets: {
                        server: '2.0.0',
                        app: '1.9.0',
                        ios: { version: '1.1.0', buildNumber: 9 },
                        computer: '1.5.0',
                        agent: '1.1.0',
                    },
                },
            ],
            null,
            2
        )}\n`
    );

    const result = Bun.spawnSync(
        ['node', join(root, 'scripts/release/sync-release-versions.mjs')],
        { cwd: root, stderr: 'pipe', stdout: 'pipe' }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString()).toBe('');
    expect(
        JSON.parse(await readFile(join(root, 'apps/website/package.json'), 'utf8')).version
    ).toBe('1.9.0');
    expect(
        JSON.parse(await readFile(join(root, 'packages/grotto-api/grotto-product.json'), 'utf8'))
            .version
    ).toBe('2.0.0');
    expect(
        JSON.parse(await readFile(join(root, 'apps/computer/package.json'), 'utf8')).version
    ).toBe('1.5.0');
    expect(
        JSON.parse(await readFile(join(root, 'packages/grotto-api/grotto-agent.json'), 'utf8'))
            .version
    ).toBe('1.1.0');
    expect(await readFile(join(root, 'apps/ios-swift/project.yml'), 'utf8')).toBe(
        'CURRENT_PROJECT_VERSION: "9"\nMARKETING_VERSION: 1.1.0\n'
    );
    expect(await readFile(join(root, 'bun.lock'), 'utf8')).toContain('"version": "1.9.0"');
    expect(await readFile(join(root, 'bun.lock'), 'utf8')).toContain('"version": "1.5.0"');
});
