import { expect, test } from 'bun:test';
import type { HarnessV1 } from '@ai-sdk/harness';
import { validateComputerBridgeAssets, withComputerBridgeBootstrap } from './bridge-bootstrap.ts';

test('Computer ships the proven pinned Codex bridge bootstrap', async () => {
    const harness = withComputerBridgeBootstrap({} as HarnessV1, 'codex');
    const bootstrap = await harness.getBootstrap?.();
    expect(bootstrap).toBeDefined();
    if (!bootstrap) {
        return;
    }
    const packageFile = bootstrap.files?.find((file) => file.path.endsWith('/package.json'));

    expect(packageFile?.content).toContain('"@openai/codex-sdk": "0.144.0"');
    expect(bootstrap.files).toContainEqual({
        content: 'grotto-computer-v1\n',
        path: '/tmp/harness/codex/grotto-computer-owner',
    });
    expect(bootstrap.commands).toContainEqual({
        command:
            'CI=true pnpm install --frozen-lockfile --store-dir /tmp/harness/codex/.pnpm-store',
        workingDirectory: '/tmp/harness/codex',
    });
    expect(bootstrap.files?.find((file) => file.path.endsWith('/bridge.mjs'))?.content).toContain(
        'Codex'
    );
    expect(
        bootstrap.files?.find((file) => file.path.endsWith('/host-tool-mcp.mjs'))?.content
    ).toContain('Server');
});

test('Computer embeds every packaged harness bridge asset', async () => {
    await expect(validateComputerBridgeAssets()).resolves.toBeUndefined();
});
