// Licensed lane: this reads @heroui-pro/react's own package.json, which only
// exists after the licensed HeroUI Pro artifact download. It is named out of
// `bun test` auto-discovery so the fast lane stays free of licensed downloads,
// and runs from `test:licensed` inside `bun run check`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const websitePackage = readJson('apps/website/package.json');
const heroUIProPackage = readJson('apps/website/node_modules/@heroui-pro/react/package.json');

test('desktop packaging can resolve HeroUI Pro runtime dependencies', () => {
    for (const [dependency, version] of Object.entries(heroUIProPackage.dependencies ?? {})) {
        assert.equal(
            websitePackage.dependencies?.[dependency],
            version,
            `${dependency} must be a direct website dependency for electron-builder's Bun collector`
        );
    }
});

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}
