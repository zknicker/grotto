import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HarnessV1, HarnessV1Bootstrap } from '@ai-sdk/harness';
import codexPackage from '../../assets/harness-bridges/codex/package.json' with { type: 'text' };
import codexLockfile from '../../assets/harness-bridges/codex/pnpm-lock.yaml' with { type: 'text' };
// @ts-expect-error -- Bun's text loader embeds this bridge in the standalone executable.
import claudeCodeBridge from '../../node_modules/@ai-sdk/harness-claude-code/dist/bridge/index.mjs' with {
    type: 'text',
};
import claudeCodePackage from '../../node_modules/@ai-sdk/harness-claude-code/dist/bridge/package.json' with {
    type: 'text',
};
import claudeCodeLockfile from '../../node_modules/@ai-sdk/harness-claude-code/dist/bridge/pnpm-lock.yaml' with {
    type: 'text',
};
// @ts-expect-error -- Bun's text loader embeds this bridge in the standalone executable.
import codexBridge from '../../node_modules/@ai-sdk/harness-codex/dist/bridge/index.mjs' with {
    type: 'text',
};

const require = createRequire(import.meta.url);

type BridgeHarnessId = 'claude-code' | 'codex';

const bridgeSpecs = {
    'claude-code': {
        bootstrapDir: '.harness-bootstrap/claude-code',
        files: [
            { assetName: 'package.json', bootstrapName: 'package.json' },
            { assetName: 'pnpm-lock.yaml', bootstrapName: 'pnpm-lock.yaml' },
            { assetName: 'index.mjs', bootstrapName: 'bridge.mjs' },
        ],
        packageName: '@ai-sdk/harness-claude-code',
        postInstallCommands: [
            'if [ -f node_modules/@anthropic-ai/claude-code/install.cjs ]; then node node_modules/@anthropic-ai/claude-code/install.cjs; fi && ./node_modules/.bin/claude --version',
        ],
    },
    codex: {
        bootstrapDir: '.harness-bootstrap/codex',
        files: [
            { assetName: 'package.json', bootstrapName: 'package.json' },
            { assetName: 'pnpm-lock.yaml', bootstrapName: 'pnpm-lock.yaml' },
            { assetName: 'index.mjs', bootstrapName: 'bridge.mjs' },
        ],
        packageName: '@ai-sdk/harness-codex',
    },
} as const;

const embeddedBridgeAssets: Record<BridgeHarnessId, Readonly<Record<string, string>>> = {
    'claude-code': {
        'index.mjs': claudeCodeBridge,
        'package.json': claudeCodePackage as unknown as string,
        'pnpm-lock.yaml': claudeCodeLockfile,
    },
    codex: {
        'index.mjs': codexBridge,
        'package.json': codexPackage as unknown as string,
        'pnpm-lock.yaml': codexLockfile,
    },
};

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

/** Release/doctor gate: embedded bridge files land where each adapter launches them. */
export async function validateComputerBridgeAssets(): Promise<void> {
    await Promise.all(
        (Object.keys(bridgeSpecs) as BridgeHarnessId[]).map((harnessId) =>
            readBridgeBootstrap(harnessId, bridgeSpecs[harnessId])
        )
    );
}

async function readBridgeBootstrap(
    harnessId: BridgeHarnessId,
    spec: (typeof bridgeSpecs)[BridgeHarnessId]
): Promise<HarnessV1Bootstrap> {
    return {
        bootstrapDir: spec.bootstrapDir,
        commands: [
            {
                command: 'CI=true pnpm install --frozen-lockfile --store-dir .pnpm-store',
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
    const embedded = embeddedBridgeAssets[harnessId][name];
    if (embedded?.length) {
        return embedded;
    }
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
