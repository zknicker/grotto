import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HarnessV1, HarnessV1Bootstrap } from '@ai-sdk/harness';

const require = createRequire(import.meta.url);

type BridgeHarnessId = 'claude-code' | 'codex';

const bridgeSpecs = {
    'claude-code': {
        bootstrapDir: '/tmp/harness/claude-code',
        files: [
            { assetName: 'package.json', bootstrapName: 'package.json' },
            { assetName: 'pnpm-lock.yaml', bootstrapName: 'pnpm-lock.yaml' },
            { assetName: 'index.mjs', bootstrapName: 'bridge.mjs' },
        ],
        packageName: '@ai-sdk/harness-claude-code',
        postInstallCommands: [
            'cd /tmp/harness/claude-code && if [ -f node_modules/@anthropic-ai/claude-code/install.cjs ]; then node node_modules/@anthropic-ai/claude-code/install.cjs; fi && ./node_modules/.bin/claude --version',
        ],
    },
    codex: {
        bootstrapDir: '/tmp/harness/codex',
        files: [
            { assetName: 'package.json', bootstrapName: 'package.json' },
            { assetName: 'pnpm-lock.yaml', bootstrapName: 'pnpm-lock.yaml' },
            { assetName: 'index.mjs', bootstrapName: 'bridge.mjs' },
            { assetName: 'host-tool-mcp.mjs', bootstrapName: 'host-tool-mcp.mjs' },
        ],
        packageName: '@ai-sdk/harness-codex',
    },
} as const;

/** The proven Runtime bridge bootstrap, now owned and shipped by Computer. */
export function withComputerBridgeBootstrap<T extends HarnessV1>(
    harness: T,
    harnessId: BridgeHarnessId
): T {
    const spec = bridgeSpecs[harnessId];
    let cachedBootstrap: HarnessV1Bootstrap | undefined;
    return {
        ...harness,
        getBootstrap: async () => {
            cachedBootstrap ??= await readBridgeBootstrap(harnessId, spec);
            return cachedBootstrap;
        },
    };
}

async function readBridgeBootstrap(
    harnessId: BridgeHarnessId,
    spec: (typeof bridgeSpecs)[BridgeHarnessId]
): Promise<HarnessV1Bootstrap> {
    return {
        bootstrapDir: spec.bootstrapDir,
        commands: [
            { command: `mkdir -p ${spec.bootstrapDir}` },
            {
                command: `CI=true pnpm install --frozen-lockfile --store-dir ${spec.bootstrapDir}/.pnpm-store`,
                workingDirectory: spec.bootstrapDir,
            },
            ...('postInstallCommands' in spec
                ? spec.postInstallCommands.map((command) => ({ command }))
                : []),
        ],
        files: [
            ...(await Promise.all(
                spec.files.map(async (file) => ({
                    content: await readBridgeAsset(harnessId, spec.packageName, file.assetName),
                    path: `${spec.bootstrapDir}/${file.bootstrapName}`,
                }))
            )),
            {
                content: 'grotto-computer-v1\n',
                path: `${spec.bootstrapDir}/grotto-computer-owner`,
            },
        ],
        harnessId,
    };
}

async function readBridgeAsset(harnessId: BridgeHarnessId, packageName: string, name: string) {
    const roots = bridgeAssetRoots(harnessId, packageName);
    for (const root of roots) {
        try {
            return await readFile(join(root, name), 'utf8');
        } catch {
            // Try the next packaged/source asset root.
        }
    }
    throw new Error(`Harness bridge asset "${harnessId}/${name}" was not found.`);
}

function bridgeAssetRoots(harnessId: BridgeHarnessId, packageName: string) {
    const roots = [
        join(
            dirname(fileURLToPath(import.meta.url)),
            '..',
            '..',
            'assets',
            'harness-bridges',
            harnessId
        ),
    ];
    try {
        roots.push(join(dirname(require.resolve(`${packageName}/package.json`)), 'dist', 'bridge'));
    } catch {
        // A compiled artifact can rely entirely on its bundled Computer assets.
    }
    return [...new Set(roots.map((root) => resolve(root)))];
}
