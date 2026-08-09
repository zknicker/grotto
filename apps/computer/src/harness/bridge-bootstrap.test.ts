import { expect, test } from 'bun:test';
import type { HarnessV1 } from '@ai-sdk/harness';
import { validateComputerBridgeAssets, withComputerBridgeBootstrap } from './bridge-bootstrap.ts';

for (const bridge of [
    {
        bootstrapDir: '/tmp/harness/codex',
        harnessId: 'codex' as const,
        packageDependency: '"@openai/codex-sdk": "0.144.5"',
    },
    {
        bootstrapDir: '/tmp/harness/claude-code',
        harnessId: 'claude-code' as const,
        packageDependency: '"@anthropic-ai/claude-code"',
    },
]) {
    test(`Computer ships the pinned ${bridge.harnessId} bridge bootstrap from its bootstrap directory`, async () => {
        const harness = withComputerBridgeBootstrap({} as HarnessV1, bridge.harnessId);
        const bootstrap = await harness.getBootstrap?.();
        expect(bootstrap).toBeDefined();
        if (!bootstrap) {
            return;
        }
        const packageFile = bootstrap.files?.find((file) => file.path.endsWith('/package.json'));

        expect(bootstrap.bootstrapDir).toBe(bridge.bootstrapDir);
        expect(packageFile?.content).toContain(bridge.packageDependency);
        expect(bootstrap.files).toContainEqual({
            content: 'grotto-computer-v1\n',
            path: `${bridge.bootstrapDir}/grotto-computer-owner`,
        });
        expect(bootstrap.commands?.[1]).toEqual({
            command: `CI=true pnpm --dir ${bridge.bootstrapDir} install --frozen-lockfile --store-dir ${bridge.bootstrapDir}/.pnpm-store`,
        });
        expect(
            bootstrap.files?.find((file) => file.path.endsWith('/bridge.mjs'))?.content
        ).toBeTruthy();
    });
}

test('Computer embeds every packaged harness bridge asset', async () => {
    await expect(validateComputerBridgeAssets()).resolves.toBeUndefined();
});
