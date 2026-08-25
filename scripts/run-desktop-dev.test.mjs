import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./run-desktop-dev.mjs', import.meta.url), 'utf8');

test('desktop development launches Electron without building a local backend sidecar', () => {
    assert.match(source, /electron\/main\.cjs/u);
    assert.doesNotMatch(source, /build-electron-sidecar/u);
});
