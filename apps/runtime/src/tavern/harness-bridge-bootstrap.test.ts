import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { HarnessV1 } from '@ai-sdk/harness';
import { afterEach, describe, expect, it } from 'vitest';
import { withRuntimeBridgeBootstrap } from './harness-bridge-bootstrap.ts';

const originalRuntimeAssetsDir = process.env.TAVERN_RUNTIME_ASSETS_DIR;

afterEach(() => {
    restoreEnv('TAVERN_RUNTIME_ASSETS_DIR', originalRuntimeAssetsDir);
});

describe('harness bridge bootstrap', () => {
    it('loads Codex bridge bootstrap assets from the Runtime asset directory', async () => {
        const assetsDir = await mkdtemp(path.join(os.tmpdir(), 'tavern-runtime-assets-'));
        const bridgeDir = path.join(assetsDir, 'harness-bridges', 'codex');
        await mkdir(bridgeDir, { recursive: true });
        await writeFile(path.join(bridgeDir, 'package.json'), '{"type":"module"}');
        await writeFile(path.join(bridgeDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
        await writeFile(path.join(bridgeDir, 'index.mjs'), 'console.log("bridge")');
        process.env.TAVERN_RUNTIME_ASSETS_DIR = assetsDir;

        const bootstrap = await withRuntimeBridgeBootstrap(fakeHarness(), 'codex').getBootstrap!();

        expect(bootstrap.harnessId).toBe('codex');
        expect(bootstrap.files).toContainEqual({
            content: '{"type":"module"}',
            path: '/tmp/harness/codex/package.json',
        });
        expect(bootstrap.files).toContainEqual({
            content: 'console.log("bridge")',
            path: '/tmp/harness/codex/bridge.mjs',
        });
    });

    it('prefers Tavern source assets over package bridge metadata', async () => {
        const bootstrap = await withRuntimeBridgeBootstrap(fakeHarness(), 'codex').getBootstrap!();

        expect(bootstrap.files).toContainEqual({
            content: expect.stringContaining('"@openai/codex-sdk": "0.144.5"'),
            path: '/tmp/harness/codex/package.json',
        });
        expect(bootstrap.files).toContainEqual({
            content: expect.stringContaining('@openai/codex@0.144.5'),
            path: '/tmp/harness/codex/pnpm-lock.yaml',
        });
        expect(bootstrap.files).toContainEqual({
            content: expect.stringContaining('startToolRelay'),
            path: '/tmp/harness/codex/bridge.mjs',
        });
    });

    it('runs bridge package install from the bootstrap directory', async () => {
        const bootstrap = await withRuntimeBridgeBootstrap(fakeHarness(), 'codex').getBootstrap!();

        expect(bootstrap.commands).toContainEqual({
            command:
                'CI=true pnpm install --frozen-lockfile --store-dir /tmp/harness/codex/.pnpm-store',
        });
    });
});

function fakeHarness() {
    return {
        builtinTools: {},
        doStart: async () => {
            throw new Error('not used');
        },
        getBootstrap: async () => {
            throw new Error('package bootstrap should not be used');
        },
        harnessId: 'codex',
        lifecycleStateSchema: {} as HarnessV1['lifecycleStateSchema'],
        specificationVersion: 'harness-v1',
        supportsBuiltinToolApprovals: false,
    } as HarnessV1;
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}
