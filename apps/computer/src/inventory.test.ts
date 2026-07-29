import { expect, test } from 'bun:test';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectInventory } from './inventory.ts';

test('discovers a runtime from the Computer search path and verifies the executable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'grotto-runtime-inventory-'));
    const codex = join(root, 'codex');
    const claude = join(root, 'claude');
    const pi = join(root, 'pi');
    try {
        await Promise.all([
            writeFile(codex, '#!/bin/sh\necho "codex-cli 0.144.0"\n'),
            writeFile(claude, '#!/bin/sh\nexit 1\n'),
            writeFile(pi, '#!/missing/interpreter\n'),
        ]);
        await Promise.all([chmod(codex, 0o755), chmod(claude, 0o755), chmod(pi, 0o755)]);

        const inventory = detectInventory({ searchPath: root });

        expect(inventory.runtimes.map((runtime) => runtime.id)).toEqual(['codex']);
    } finally {
        await rm(root, { force: true, recursive: true });
    }
});
