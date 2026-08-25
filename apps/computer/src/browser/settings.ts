import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
    type AgentRuntimeBrowserActionResult,
    type AgentRuntimeBrowserSettings,
    type AgentRuntimeSaveBrowserSettings,
    agentRuntimeBrowserActionResultSchema,
    agentRuntimeBrowserProfileNameSchema,
    agentRuntimeBrowserSettingsSchema,
    agentRuntimeSaveBrowserSettingsSchema,
} from '@grotto/api';
import * as z from 'zod';
import { detectChromeApplications } from './chrome-detection.ts';
import { getBrowserService, startBrowserService, stopBrowserService } from './service.ts';

const execFileAsync = promisify(execFile);
const defaultBrowserProfileName = 'default';

const storedBrowserConfigSchema = z
    .object({
        enabled: z.boolean(),
        profileName: agentRuntimeBrowserProfileNameSchema.default(defaultBrowserProfileName),
        updatedAt: z.iso.datetime({ offset: true }).nullable(),
    })
    .strict();

type BrowserConfig = z.infer<typeof storedBrowserConfigSchema>;

export async function getComputerBrowserSettings(
    root: string
): Promise<AgentRuntimeBrowserSettings> {
    const config = await readBrowserConfig(root);
    const service = getBrowserService();
    const [application] =
        service?.root === root ? [service.application] : await detectChromeApplications();

    return agentRuntimeBrowserSettingsSchema.parse({
        affectedAgents: [],
        application: application ? { path: application.path, version: application.version } : null,
        enabled: config.enabled,
        profileName: config.profileName,
        skillConflict: null,
        status:
            service?.root === root && service.profileName === config.profileName
                ? await service.supervisor.status()
                : null,
        updatedAt: config.updatedAt,
    });
}

export async function saveComputerBrowserSettings(
    root: string,
    input: AgentRuntimeSaveBrowserSettings
): Promise<AgentRuntimeBrowserSettings> {
    const parsed = agentRuntimeSaveBrowserSettingsSchema.parse(input);
    const current = await readBrowserConfig(root);
    const next = {
        enabled: parsed.enabled ?? current.enabled,
        profileName: parsed.profileName ?? current.profileName,
        updatedAt: new Date().toISOString(),
    } satisfies BrowserConfig;
    const service = getBrowserService();

    if (service?.root === root && service.profileName !== next.profileName) {
        await service.lifecycle.stop().catch(() => undefined);
    }

    await writeBrowserConfig(root, next);
    await reconcileComputerBrowser(root);
    return await getComputerBrowserSettings(root);
}

export async function reconcileComputerBrowser(root: string): Promise<void> {
    const config = await readBrowserConfig(root);
    if (!config.enabled) {
        if (getBrowserService()?.root === root) {
            stopBrowserService();
        }
        return;
    }
    await startBrowserService({ profileName: config.profileName, root });
}

export async function openComputerBrowser(root: string): Promise<AgentRuntimeBrowserActionResult> {
    const service = await requireBrowserService(root);
    await service.supervisor.startBrowser();
    await activateChrome();
    return agentRuntimeBrowserActionResultSchema.parse({
        message: null,
        ok: true,
        status: await service.supervisor.status(),
    });
}

export async function restartComputerBrowser(
    root: string
): Promise<AgentRuntimeBrowserActionResult> {
    const service = await requireBrowserService(root);
    await service.supervisor.restartBrowser();
    return agentRuntimeBrowserActionResultSchema.parse({
        message: null,
        ok: true,
        status: await service.supervisor.status(),
    });
}

async function requireBrowserService(root: string) {
    await reconcileComputerBrowser(root);
    const service = getBrowserService();
    if (service?.root !== root) {
        throw new Error('Browser is unavailable on this Computer.');
    }
    return service;
}

async function readBrowserConfig(root: string): Promise<BrowserConfig> {
    try {
        return storedBrowserConfigSchema.parse(
            JSON.parse(await readFile(settingsPath(root), 'utf8'))
        );
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
        return {
            enabled: false,
            profileName: defaultBrowserProfileName,
            updatedAt: null,
        };
    }
}

async function writeBrowserConfig(root: string, config: BrowserConfig): Promise<void> {
    await mkdir(root, { mode: 0o700, recursive: true });
    const destination = settingsPath(root);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, destination);
}

function settingsPath(root: string) {
    return join(root, 'settings.json');
}

async function activateChrome(): Promise<void> {
    try {
        await execFileAsync(
            '/usr/bin/osascript',
            ['-e', 'tell application "Google Chrome" to activate'],
            { timeout: 5000 }
        );
    } catch {
        // Activation is best-effort; the browser is running either way.
    }
}
