import { expect, test } from 'bun:test';
import { createClaudeCode } from '@ai-sdk/harness-claude-code';
import { createCodex } from '@ai-sdk/harness-codex';
import { validateComputerBridgeAssets, withComputerBridgeBootstrap } from './bridge-bootstrap.ts';

for (const bridge of [
    {
        bootstrapDir: '.harness-bootstrap/codex',
        harnessId: 'codex' as const,
        nativeHarness: createCodex(),
        packageDependency: '"@openai/codex-sdk": "0.144.5"',
    },
    {
        bootstrapDir: '.harness-bootstrap/claude-code',
        harnessId: 'claude-code' as const,
        nativeHarness: createClaudeCode(),
        packageDependency: '"@anthropic-ai/claude-code"',
    },
]) {
    test(`Computer ships the pinned ${bridge.harnessId} bridge bootstrap from its bootstrap directory`, async () => {
        const harness = withComputerBridgeBootstrap(bridge.nativeHarness, bridge.harnessId);
        const bootstrap = await harness.getBootstrap?.();
        const nativeBootstrap = await bridge.nativeHarness.getBootstrap?.();
        expect(bootstrap).toBeDefined();
        expect(nativeBootstrap).toBeDefined();
        if (!(bootstrap && nativeBootstrap)) {
            return;
        }
        const packageFile = bootstrap.files?.find((file) => file.path.endsWith('/package.json'));

        expect(bootstrap.bootstrapDir).toBe(bridge.bootstrapDir);
        expect(bootstrap.bootstrapDir).toBe(nativeBootstrap.bootstrapDir);
        expect(packageFile?.content).toContain(bridge.packageDependency);
        expect(bootstrap.files).toContainEqual({
            content: 'grotto-computer-v1\n',
            path: `${bridge.bootstrapDir}/grotto-computer-owner`,
        });
        expect(bootstrap.commands?.[0]).toEqual({
            command: 'CI=true pnpm install --frozen-lockfile --store-dir .pnpm-store',
        });
        expect(
            bootstrap.files?.find((file) => file.path.endsWith('/bridge.mjs'))?.content
        ).toBeTruthy();
    });
}

test('Computer embeds every packaged harness bridge asset', async () => {
    await expect(validateComputerBridgeAssets()).resolves.toBeUndefined();
});
