import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HarnessV1, HarnessV1Bootstrap } from '@ai-sdk/harness';

import { readConfigValue, resolveConfiguredPath } from '../config.ts';

const require = createRequire(import.meta.url);

type RuntimeBridgeHarnessId = 'claude-code' | 'codex';

interface BridgeFileSpec {
    assetName: string;
    bootstrapName: string;
}

interface BridgeBootstrapSpec {
    assetDir: string;
    bootstrapDir: string;
    files: readonly BridgeFileSpec[];
    harnessId: RuntimeBridgeHarnessId;
    packageName: string;
    postInstallCommands?: readonly string[];
}

const bridgeSpecs = {
    'claude-code': {
        assetDir: 'claude-code',
        bootstrapDir: '/tmp/harness/claude-code',
        files: [
            { assetName: 'package.json', bootstrapName: 'package.json' },
            { assetName: 'pnpm-lock.yaml', bootstrapName: 'pnpm-lock.yaml' },
            { assetName: 'index.mjs', bootstrapName: 'bridge.mjs' },
        ],
        harnessId: 'claude-code',
        packageName: '@ai-sdk/harness-claude-code',
        postInstallCommands: [
            'cd /tmp/harness/claude-code && if [ -f node_modules/@anthropic-ai/claude-code/install.cjs ]; then node node_modules/@anthropic-ai/claude-code/install.cjs; fi && ./node_modules/.bin/claude --version',
        ],
    },
    codex: {
        assetDir: 'codex',
        bootstrapDir: '/tmp/harness/codex',
        files: [
            { assetName: 'package.json', bootstrapName: 'package.json' },
            { assetName: 'pnpm-lock.yaml', bootstrapName: 'pnpm-lock.yaml' },
            { assetName: 'index.mjs', bootstrapName: 'bridge.mjs' },
        ],
        harnessId: 'codex',
        packageName: '@ai-sdk/harness-codex',
    },
} as const satisfies Record<RuntimeBridgeHarnessId, BridgeBootstrapSpec>;

export function withRuntimeBridgeBootstrap<T extends HarnessV1>(
    harness: T,
    harnessId: RuntimeBridgeHarnessId
): T {
    const spec = bridgeSpecs[harnessId];
    let cachedBootstrap: HarnessV1Bootstrap | undefined;

    return {
        ...harness,
        getBootstrap: async () => {
            cachedBootstrap ??= await readBridgeBootstrap(spec);
            return cachedBootstrap;
        },
    };
}

async function readBridgeBootstrap(spec: BridgeBootstrapSpec): Promise<HarnessV1Bootstrap> {
    const files = await Promise.all(
        spec.files.map(async (file) => ({
            content: await readBridgeAsset(spec, file.assetName),
            path: `${spec.bootstrapDir}/${file.bootstrapName}`,
        }))
    );

    return {
        bootstrapDir: spec.bootstrapDir,
        commands: [
            { command: `mkdir -p ${spec.bootstrapDir}` },
            {
                command: `CI=true pnpm install --frozen-lockfile --store-dir ${spec.bootstrapDir}/.pnpm-store`,
            },
            ...(spec.postInstallCommands ?? []).map((command) => ({ command })),
        ],
        files,
        harnessId: spec.harnessId,
    };
}

async function readBridgeAsset(spec: BridgeBootstrapSpec, name: string) {
    const errors: unknown[] = [];
    for (const root of bridgeAssetRoots(spec)) {
        try {
            return await fs.readFile(path.join(root, name), 'utf8');
        } catch (error) {
            errors.push(error);
        }
    }

    const searched = bridgeAssetRoots(spec).join(', ');
    throw new Error(
        `Harness bridge asset "${spec.harnessId}/${name}" was not found in ${searched}`,
        {
            cause: errors.at(-1),
        }
    );
}

function bridgeAssetRoots(spec: BridgeBootstrapSpec) {
    return uniquePaths(
        [
            runtimeAssetsBridgeRoot(spec),
            homebrewRuntimeAssetsBridgeRoot(spec),
            sourceAssetsBridgeRoot(spec),
            packageBridgeRoot(spec),
        ].filter((candidate): candidate is string => Boolean(candidate))
    );
}

function runtimeAssetsBridgeRoot(spec: BridgeBootstrapSpec) {
    const assetsDir = readConfigValue('TAVERN_RUNTIME_ASSETS_DIR');
    return assetsDir
        ? path.join(resolveConfiguredPath(assetsDir), 'harness-bridges', spec.assetDir)
        : null;
}

function homebrewRuntimeAssetsBridgeRoot(spec: BridgeBootstrapSpec) {
    return path.join(
        path.dirname(process.execPath),
        '..',
        'share',
        'grotto',
        'runtime-assets',
        'harness-bridges',
        spec.assetDir
    );
}

function packageBridgeRoot(spec: BridgeBootstrapSpec) {
    try {
        const packageJson = require.resolve(`${spec.packageName}/package.json`);
        if (packageJson.startsWith('/$bunfs/')) {
            return null;
        }
        return path.join(path.dirname(packageJson), 'dist', 'bridge');
    } catch {
        return null;
    }
}

function sourceAssetsBridgeRoot(spec: BridgeBootstrapSpec) {
    return path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'assets',
        'harness-bridges',
        spec.assetDir
    );
}

function uniquePaths(paths: readonly string[]) {
    return [...new Set(paths.map((candidate) => path.resolve(candidate)))];
}
