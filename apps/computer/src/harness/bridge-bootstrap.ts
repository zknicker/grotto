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
        postInstallCommands: [
            // Constructing Codex runs the SDK's platform-binary resolution —
            // the exact path that breaks when the optional dependency is lost.
            `node --input-type=module -e 'const { Codex } = await import("@openai/codex-sdk"); new Codex();'`,
        ],
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

/**
 * The proven Runtime bridge bootstrap, now owned and shipped by Computer.
 * `storeDir` points every Agent's install at one shared, content-addressed
 * pnpm store (pnpm serializes concurrent store access itself) so the runtime's
 * platform binary is fetched once per Computer instead of once per Agent.
 */
export function withComputerBridgeBootstrap<T extends HarnessV1>(
    harness: T,
    harnessId: BridgeHarnessId,
    { storeDir }: { storeDir?: string } = {}
): T {
    const spec = bridgeSpecs[harnessId];
    let cachedBootstrap: HarnessV1Bootstrap | undefined;
    return {
        ...harness,
        getBootstrap: async () => {
            cachedBootstrap ??= await readBridgeBootstrap(harnessId, spec, storeDir);
            return cachedBootstrap;
        },
    };
}

/** The one shared store location per server tree; executor and pre-warm must agree. */
export function bridgeStoreDirForAgentsRoot(agentsRoot: string) {
    return join(agentsRoot, '.harness-bridge-store');
}

/**
 * Everything a boot-time pre-warm needs to populate the shared store before
 * any Agent exists: the pinned manifest + lockfile and the same verified
 * install the per-Agent bootstrap will later run (which then hard-links from
 * the warm store instead of fetching).
 */
export async function readBridgePrewarmPlans(): Promise<
    Array<{
        command: (storeDir: string) => string;
        files: Array<{ content: string; name: string }>;
        harnessId: BridgeHarnessId;
    }>
> {
    return await Promise.all(
        (Object.keys(bridgeSpecs) as BridgeHarnessId[]).map(async (harnessId) => {
            const spec = bridgeSpecs[harnessId];
            return {
                command: (storeDir: string) =>
                    [
                        installCommand(storeDir),
                        ...('postInstallCommands' in spec
                            ? spec.postInstallCommands.map((command) =>
                                  verifiedCommand(command, storeDir)
                              )
                            : []),
                    ].join(' && '),
                files: await Promise.all(
                    spec.files
                        .filter((file) => file.assetName !== 'index.mjs')
                        .map(async (file) => ({
                            content: await readBridgeAsset(
                                harnessId,
                                spec.packageName,
                                file.assetName
                            ),
                            name: file.bootstrapName,
                        }))
                ),
                harnessId,
            };
        })
    );
}

/** Release/doctor gate: embedded bridge files land where each adapter launches them. */
export async function validateComputerBridgeAssets(): Promise<void> {
    await Promise.all(
        (Object.keys(bridgeSpecs) as BridgeHarnessId[]).map((harnessId) =>
            readBridgeBootstrap(harnessId, bridgeSpecs[harnessId])
        )
    );
}

function installCommand(storeDir?: string) {
    return `CI=true pnpm install --frozen-lockfile --store-dir ${storeDir ? `"${storeDir}"` : '.pnpm-store'}`;
}

/**
 * pnpm exits 0 even when an OPTIONAL dependency (the runtime's platform
 * binary) fails to download — observed live under concurrent first-time
 * bootstraps, leaving a bridge that fails every turn. Each post-install
 * command therefore doubles as the verification gate: on failure it retries
 * once from a clean slate, and if that also fails the bootstrap fails loudly.
 * A failed bootstrap writes no completion marker, so the next session start
 * re-runs it rather than keeping a broken bridge forever. A SHARED store is
 * never wiped on retry — other Agents hard-link from it concurrently.
 */
function verifiedCommand(command: string, storeDir?: string) {
    const wipe = storeDir ? 'node_modules' : 'node_modules .pnpm-store';
    return `(${command}) || (rm -rf ${wipe} && ${installCommand(storeDir)} && (${command}))`;
}

async function readBridgeBootstrap(
    harnessId: BridgeHarnessId,
    spec: (typeof bridgeSpecs)[BridgeHarnessId],
    storeDir?: string
): Promise<HarnessV1Bootstrap> {
    return {
        bootstrapDir: spec.bootstrapDir,
        commands: [
            { command: installCommand(storeDir) },
            ...('postInstallCommands' in spec
                ? spec.postInstallCommands.map((command) => ({
                      command: verifiedCommand(command, storeDir),
                  }))
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
