import { expect, test } from 'bun:test';
import { createClaudeCode } from '@ai-sdk/harness-claude-code';
import { createCodex } from '@ai-sdk/harness-codex';
import { createGrokBuild } from '@ai-sdk/harness-grok-build';
import { validateComputerBridgeAssets, withComputerBridgeBootstrap } from './bridge-bootstrap.ts';

for (const bridge of [
    {
        bootstrapDir: '.harness-bootstrap/codex',
        harnessId: 'codex' as const,
        nativeHarness: createCodex(),
        packageDependency: '"@openai/codex-sdk": "0.144.5"',
        verifyFragment: 'new Codex();',
    },
    {
        bootstrapDir: '.harness-bootstrap/claude-code',
        harnessId: 'claude-code' as const,
        nativeHarness: createClaudeCode(),
        packageDependency: '"@anthropic-ai/claude-code"',
        verifyFragment: './node_modules/.bin/claude --version',
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
        // The post-install verify gates the bootstrap: a lost optional
        // platform binary exits pnpm 0, so without this gate the completion
        // marker would seal a permanently broken bridge. The verify retries
        // once from a clean slate before failing the bootstrap loudly.
        const verify = bootstrap.commands?.at(-1)?.command ?? '';
        expect(bootstrap.commands).toHaveLength(2);
        expect(verify).toContain(bridge.verifyFragment);
        expect(verify).toContain(
            '|| (rm -rf node_modules .pnpm-store && CI=true pnpm install --frozen-lockfile --store-dir .pnpm-store && ('
        );
        expect(
            bootstrap.files?.find((file) => file.path.endsWith('/bridge.mjs'))?.content
        ).toBeTruthy();
    });
}

test('a shared store directory rides every install and is never wiped on retry', async () => {
    const harness = withComputerBridgeBootstrap(createCodex(), 'codex', {
        storeDir: '/computer/agents/.harness-bridge-store',
    });
    const bootstrap = await harness.getBootstrap?.();
    const install = bootstrap?.commands?.[0]?.command ?? '';
    const verify = bootstrap?.commands?.at(-1)?.command ?? '';

    expect(install).toContain('--store-dir "/computer/agents/.harness-bridge-store"');
    expect(verify).toContain('--store-dir "/computer/agents/.harness-bridge-store"');
    // Other Agents hard-link from the shared store concurrently; the clean
    // retry may only wipe this bootstrap's own node_modules.
    expect(verify).toContain('rm -rf node_modules &&');
    expect(verify).not.toContain('.pnpm-store &&');
});

test('Computer embeds every packaged harness bridge asset', async () => {
    await expect(validateComputerBridgeAssets()).resolves.toBeUndefined();
});

test('Codex bridge keeps recoverable transport errors distinct from failed turns', async () => {
    const bootstrap = await withComputerBridgeBootstrap(createCodex(), 'codex').getBootstrap?.();
    const bridge = bootstrap?.files?.find((file) => file.path.endsWith('/bridge.mjs'))?.content;

    expect(bridge).toContain('codex stream warning');
    expect(bridge).toContain('emitWarning');
    expect(bridge).toContain('codex turn failed');
    expect(bridge).toContain('emitError');
});

test('Claude Code bridge captures structured plan usage only when Computer leases a refresh', async () => {
    const bootstrap = await withComputerBridgeBootstrap(
        createClaudeCode(),
        'claude-code'
    ).getBootstrap?.();
    const bridge = bootstrap?.files?.find((file) => file.path.endsWith('/bridge.mjs'))?.content;

    expect(bridge).toContain('GROTTO_CLAUDE_USAGE_REFRESH');
    expect(bridge).toContain('usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET');
    expect(bridge).toContain('planUsage');
});

test('Grok Build bridge pins the private live-interjection contract', async () => {
    const bootstrap = await createGrokBuild().getBootstrap?.();
    const bridge = bootstrap?.files?.find(
        (file) => file.path === '.harness-bootstrap/grok-build/bridge.mjs'
    )?.content;

    expect(bridge).toBeDefined();
    expect(bridge).toContain('connection.agent.request("_x.ai/interject"');
    expect(bridge).not.toContain('connection.agent.request("x.ai/interject"');
    expect(bridge).toContain('await interjectionReady');
    expect(bridge).toContain('message.kind === "session_update"');
    expect(bridge).toContain('markInterjectionReady?.()');
    expect(bridge).toContain('grok-interjection-accepted');
    expect(bridge).toContain('grok-interjection-rejected');
});
