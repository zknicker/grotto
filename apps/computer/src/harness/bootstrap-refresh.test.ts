import { afterEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HarnessV1 } from '@ai-sdk/harness';
import { fingerprintHarnessBootstrap, refreshHarnessBootstrap } from './bootstrap-refresh.ts';
import { createLocalTrustedSandboxProvider } from './sandbox.ts';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('refreshes changed bridge assets before a resumed session starts', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'grotto-bootstrap-refresh-')));
    roots.push(root);
    const bridgePath = join(root, '.harness-bootstrap', 'test', 'bridge.mjs');
    await mkdir(join(root, '.harness-bootstrap', 'test'), { recursive: true });
    await writeFile(bridgePath, 'old bridge');
    const harness = fakeHarness('current bridge');
    const provider = createLocalTrustedSandboxProvider({ rootDir: root });

    await refreshHarnessBootstrap({
        harness,
        provider,
        sessionId: 'session_one',
        workDir: 'workspace',
    });

    expect(await readFile(bridgePath, 'utf8')).toBe('current bridge');
});

test('bootstrap fingerprints include both the adapter recipe and Harness release', async () => {
    expect(
        await fingerprintHarnessBootstrap({
            frameworkVersion: '1.0.70',
            harness: fakeHarness('bridge one'),
        })
    ).toBe(
        await fingerprintHarnessBootstrap({
            frameworkVersion: '1.0.70',
            harness: fakeHarness('bridge one'),
        })
    );
    expect(
        await fingerprintHarnessBootstrap({
            frameworkVersion: '1.0.70',
            harness: fakeHarness('bridge one'),
        })
    ).not.toBe(
        await fingerprintHarnessBootstrap({
            frameworkVersion: '1.0.70',
            harness: fakeHarness('bridge two'),
        })
    );
    expect(
        await fingerprintHarnessBootstrap({
            frameworkVersion: '1.0.70',
            harness: fakeHarness('bridge one'),
        })
    ).not.toBe(
        await fingerprintHarnessBootstrap({
            frameworkVersion: '1.0.71',
            harness: fakeHarness('bridge one'),
        })
    );
});

function fakeHarness(bridge: string): HarnessV1 {
    return {
        builtinTools: {},
        doStart: async () => {
            throw new Error('Not used by this test.');
        },
        getBootstrap: async () => ({
            bootstrapDir: '.harness-bootstrap/test',
            commands: [],
            files: [{ content: bridge, path: '.harness-bootstrap/test/bridge.mjs' }],
            harnessId: 'test',
        }),
        harnessId: 'test',
        specificationVersion: 'harness-v1',
    };
}
