import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('Server publisher consumes prebuilt App artifacts without publishing desktop', async () => {
    const source = await readFile(new URL('./publish-release.mjs', import.meta.url), 'utf8');

    expect(source).toContain("run('bun', ['run', 'release:check-desktop-artifacts'])");
    expect(source).not.toContain("run('bun', ['run', 'publish:desktop']");
    expect(source).not.toContain('GROTTO_RELEASE_INCLUDE_DESKTOP');
    expect(source).not.toMatch(/\['commit'/u);
    expect(source).not.toMatch(/HEAD:\$\{/u);
});
