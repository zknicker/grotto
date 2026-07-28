import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDevPorts } from './dev-ports.mjs';
import { DevStackController } from './dev-stack-controller.mjs';
import { DevStackScreen } from './dev-stack-screen.mjs';

function main() {
    const mode = process.argv[2] ?? 'web';
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const ports = resolveDevPorts({ repositoryRoot });
    const runtimeEnvironmentOverrides = getRuntimeEnvironmentOverrides(repositoryRoot);
    const controller = new DevStackController({
        mode,
        ports,
        repositoryRoot,
        runtimeEnvironmentOverrides,
    });
    const screen = new DevStackScreen(controller);
    screen.start();

    const stop = (signal) => {
        void controller.stop(signal === 'SIGINT' ? 130 : 143, {
            force: true,
            signal,
        });
    };

    process.on('SIGINT', () => stop('SIGINT'));
    process.on('SIGTERM', () => stop('SIGTERM'));

    controller.on('exit', (code) => {
        screen.stop();
        process.exit(code);
    });

    void controller.start().catch((error) => {
        controller.addLog('tavern', error instanceof Error ? error.message : String(error));
        void controller.stop(1);
    });
}

function getRuntimeEnvironmentOverrides(repositoryRoot) {
    const envPath = path.join(repositoryRoot, 'apps', 'website', '.env.development');
    const publishableKey =
        process.env.TAVERN_CLERK_PUBLISHABLE_KEY ??
        readEnvValue(envPath, 'VITE_CLERK_PUBLISHABLE_KEY');
    const overrides = {};

    if (publishableKey && process.env.TAVERN_CLERK_PUBLISHABLE_KEY === undefined) {
        overrides.TAVERN_CLERK_PUBLISHABLE_KEY = publishableKey;
    }
    if (publishableKey && process.env.CLERK_ISSUER_URL === undefined) {
        overrides.CLERK_ISSUER_URL = clerkIssuerFromPublishableKey(publishableKey);
    }

    return overrides;
}

function clerkIssuerFromPublishableKey(publishableKey) {
    const encodedFrontendApi = publishableKey.split('_')[2];
    if (!encodedFrontendApi) {
        throw new Error('The Clerk publishable key is invalid.');
    }

    const decoded = Buffer.from(encodedFrontendApi, 'base64').toString('utf8');
    const frontendApi = decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
    if (!frontendApi.includes('.')) {
        throw new Error('The Clerk publishable key does not contain a valid issuer.');
    }

    return `https://${frontendApi}`;
}

function readEnvValue(envPath, key) {
    try {
        const prefix = `${key}=`;
        const line = fs
            .readFileSync(envPath, 'utf8')
            .split(/\r?\n/u)
            .map((candidate) => candidate.trim())
            .find((candidate) => candidate.startsWith(prefix));

        return line?.slice(prefix.length).trim() || null;
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
