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

test('bumps every coordinated release file before returning success', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-release-bump-'));
    temporaryRoots.push(root);
    await mkdir(join(root, 'apps/website'), { recursive: true });
    await mkdir(join(root, 'apps/ios-swift/Grotto.xcodeproj'), { recursive: true });
    await mkdir(join(root, 'scripts/release'), { recursive: true });
    await Promise.all(
        ['bump-version.mjs', 'release-ledger.mjs', 'release-utils.mjs'].map((file) =>
            copyFile(join(releaseScriptRoot, file), join(root, 'scripts/release', file))
        )
    );
    await writeFile(
        join(root, 'apps/website/package.json'),
        `${JSON.stringify({ version: '1.8.19' }, null, 2)}\n`
    );
    await writeFile(
        join(root, 'apps/ios-swift/project.yml'),
        'settings:\n  base:\n    MARKETING_VERSION: 1.8.19\n'
    );
    await writeFile(
        join(root, 'apps/ios-swift/Grotto.xcodeproj/project.pbxproj'),
        'Debug { MARKETING_VERSION = 1.8.19; }\nRelease { MARKETING_VERSION = 1.8.19; }\n'
    );
    await writeFile(join(root, 'CHANGELOG.md'), '## v1.8.19 - 2026-08-19\n');
    const originalLedger = `${JSON.stringify(
        [
            {
                version: '1.8.19',
                date: '2026-08-19',
                targets: { server: '1.8.19', app: null, ios: null, computer: null },
            },
        ],
        null,
        2
    )}\n`;
    await writeFile(join(root, 'releases.json'), originalLedger);

    const result = Bun.spawnSync(
        ['node', join(root, 'scripts/release/bump-version.mjs'), 'patch'],
        {
            cwd: root,
            stderr: 'pipe',
            stdout: 'pipe',
        }
    );

    expect(result.stderr.toString()).toBe('');
    expect(result.exitCode).toBe(0);
    expect(
        JSON.parse(await readFile(join(root, 'apps/website/package.json'), 'utf8')).version
    ).toBe('1.8.20');
    expect(await readFile(join(root, 'apps/ios-swift/project.yml'), 'utf8')).toContain(
        'MARKETING_VERSION: 1.8.20'
    );
    expect(
        await readFile(join(root, 'apps/ios-swift/Grotto.xcodeproj/project.pbxproj'), 'utf8')
    ).toBe('Debug { MARKETING_VERSION = 1.8.20; }\nRelease { MARKETING_VERSION = 1.8.20; }\n');
    const updatedLedger = await readFile(join(root, 'releases.json'), 'utf8');
    expect(updatedLedger.startsWith(originalLedger.replace(/\n\]\n$/u, ''))).toBe(true);
    expect(JSON.parse(updatedLedger).at(-1)).toEqual({
        version: '1.8.20',
        date: null,
        targets: { server: '1.8.20', app: 'undecided', ios: 'undecided', computer: 'undecided' },
    });
});
