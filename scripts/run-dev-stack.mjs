import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDevPorts } from './dev-ports.mjs';
import { DevStackController } from './dev-stack-controller.mjs';
import { DevStackScreen } from './dev-stack-screen.mjs';
import { HEROUI_PACKAGE_PATH, hasHeroUiArtifacts, heroUiPackageRoot } from './heroui-artifacts.mjs';

function main() {
    const mode = process.argv[2] ?? 'web';
    if (!['desktop', 'web'].includes(mode)) {
        console.error(`Unknown dev stack mode "${mode}". Use "web" or "desktop".`);
        process.exit(1);
    }
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    // Starting vite without these artifacts caches a broken @heroui-pro/react
    // resolution that survives a restart, so refuse the boot instead.
    if (!hasHeroUiArtifacts(heroUiPackageRoot(repositoryRoot))) {
        console.error(
            `${HEROUI_PACKAGE_PATH} is missing its downloaded artifacts. Run \`bun run setup:worktree\` before starting the dev stack.`
        );
        process.exit(1);
    }
    const ports = resolveDevPorts({ repositoryRoot });
    const clerkEnvironmentOverrides = getDevEnvironmentOverrides(repositoryRoot);
    const controller = new DevStackController({
        mode,
        ports,
        repositoryRoot,
        clerkEnvironmentOverrides,
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

export function getDevEnvironmentOverrides(repositoryRoot, environment = process.env) {
    const rootEnvPath = path.join(repositoryRoot, '.env');
    const websiteEnvPath = path.join(repositoryRoot, 'apps', 'website', '.env.development');
    const publishableKey =
        environment.TAVERN_CLERK_PUBLISHABLE_KEY ??
        readEnvValue(websiteEnvPath, 'VITE_CLERK_PUBLISHABLE_KEY');
    const overrides = {};

    if (publishableKey && environment.TAVERN_CLERK_PUBLISHABLE_KEY === undefined) {
        overrides.TAVERN_CLERK_PUBLISHABLE_KEY = publishableKey;
    }
    if (publishableKey && environment.CLERK_ISSUER_URL === undefined) {
        overrides.CLERK_ISSUER_URL = clerkIssuerFromPublishableKey(publishableKey);
    }
    for (const key of ['CLERK_SECRET_KEY', 'DEV_CLERK_SIGN_IN_USER_ID']) {
        const value = environment[key] ?? readEnvValue(rootEnvPath, key);
        if (value && environment[key] === undefined) {
            overrides[key] = value;
        }
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
