import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
    type AgentRuntimeBrowserActionResult,
    type AgentRuntimeBrowserSettings,
    type AgentRuntimeBrowserStatus,
    type AgentRuntimeSaveBrowserSettings,
    agentRuntimeBrowserActionResultSchema,
    agentRuntimeBrowserProfileNameSchema,
    agentRuntimeBrowserSettingsSchema,
    agentRuntimeSaveBrowserSettingsSchema,
} from '@tavern/api';
import * as z from 'zod';
import { clearHostToolGrants, listAgentsWithHostToolGrant } from '../agent-engine/host-tools.ts';
import type { RuntimeCapabilityCheckResult } from '../capabilities/definitions.ts';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { detectChromeApplications } from './chrome-detection.ts';
import { getBrowserService, startBrowserService, stopBrowserService } from './service.ts';

const execFileAsync = promisify(execFile);

export const defaultBrowserProfileName = 'default';

const storedBrowserConfigSchema = z.object({
    enabled: z.boolean(),
    profileName: agentRuntimeBrowserProfileNameSchema.default(defaultBrowserProfileName),
    updatedAt: z.string().datetime().nullable(),
});

export async function getBrowserSettings(): Promise<AgentRuntimeBrowserSettings> {
    const config = readBrowserConfig();
    const service = getBrowserService();
    const [application] = service ? [service.application] : await detectChromeApplications();

    return agentRuntimeBrowserSettingsSchema.parse({
        affectedAgents: listAgentsWithHostToolGrant('browser'),
        application: application ? { path: application.path, version: application.version } : null,
        enabled: config.enabled,
        profileName: config.profileName,
        skillConflict: null,
        status: service ? await service.supervisor.status() : null,
        updatedAt: config.updatedAt,
    });
}

export async function saveBrowserSettings(
    input: AgentRuntimeSaveBrowserSettings
): Promise<AgentRuntimeBrowserSettings> {
    const parsed = agentRuntimeSaveBrowserSettingsSchema.parse(input);
    const current = readBrowserConfig();
    const profileName = parsed.profileName ?? current.profileName;
    const enabled = parsed.enabled ?? current.enabled;

    // Switching profiles is an explicit operator action: the old managed
    // Chrome is stopped gracefully first so it does not keep writing the old
    // profile unsupervised. Profile directories are never deleted.
    const service = getBrowserService();
    if (service && profileName !== service.profileName) {
        await service.lifecycle.stop().catch(() => undefined);
    }

    writeBrowserConfig({ enabled, profileName });
    if (!enabled) {
        clearHostToolGrants('browser');
    }
    await reconcileBrowserService();
    return getBrowserSettings();
}

// Starts or stops browser supervision to match stored settings. Called on
// Runtime startup and after settings changes; failures degrade the
// Browser capability instead of propagating.
export async function reconcileBrowserService(): Promise<void> {
    const config = readBrowserConfig();
    if (!config.enabled) {
        stopBrowserService();
        return;
    }
    await startBrowserService({ profileName: config.profileName });
}

export async function checkBrowserCapability(): Promise<RuntimeCapabilityCheckResult> {
    const config = readBrowserConfig();
    if (!config.enabled) {
        return { reason: 'Browser is disabled.', state: 'unavailable' };
    }
    if (process.platform !== 'darwin') {
        return {
            reason: 'Browser requires a macOS Runtime host.',
            state: 'unavailable',
        };
    }

    const service = getBrowserService();
    if (!service) {
        const [application] = await detectChromeApplications();
        if (!application) {
            return {
                reason: 'Install Google Chrome to enable Browser.',
                state: 'unavailable',
            };
        }
        return {
            reason: 'Browser supervision is not running.',
            state: 'unavailable',
        };
    }

    const status = await service.supervisor.status();
    return mapBrowserStatusToCapability(status, service.profileName);
}

function readBrowserConfig() {
    const row = getDb()
        .prepare(
            `SELECT enabled, profile_name, updated_at
             FROM browser_settings
             WHERE singleton = 1`
        )
        .get() as { enabled: number; profile_name: string; updated_at: string } | undefined;

    return storedBrowserConfigSchema.parse(
        row
            ? {
                  enabled: Boolean(row.enabled),
                  profileName: row.profile_name,
                  updatedAt: row.updated_at,
              }
            : {
                  enabled: false,
                  profileName: defaultBrowserProfileName,
                  updatedAt: null,
              }
    );
}

function writeBrowserConfig(input: { enabled: boolean; profileName: string }) {
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO browser_settings
             (singleton, enabled, profile_name, created_at, updated_at)
             VALUES (1, $enabled, $profileName, $now, $now)
             ON CONFLICT(singleton) DO UPDATE SET
               enabled = excluded.enabled,
               profile_name = excluded.profile_name,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                enabled: input.enabled ? 1 : 0,
                now,
                profileName: input.profileName,
            })
        );
}

function mapBrowserStatusToCapability(
    status: AgentRuntimeBrowserStatus,
    profileName: string
): RuntimeCapabilityCheckResult {
    const metadata: Record<string, unknown> = {
        browserVersion: status.browserVersion,
        profileName,
        state: status.state,
    };
    switch (status.state) {
        case 'healthy':
            return { metadata, state: 'healthy' };
        case 'pressured':
            // Pressure stays healthy: browser work remains available and
            // pressure alone never restarts Chrome.
            return {
                metadata: {
                    ...metadata,
                    gpuCpuPercent: status.resources.gpuCpuPercent,
                    pressureSince: status.pressureSince,
                },
                state: 'healthy',
            };
        case 'starting':
        case 'recovering':
            return {
                metadata,
                reason: status.reason ?? 'Browser is temporarily unavailable.',
                state: 'degraded',
            };
        default:
            return {
                metadata,
                reason: status.reason ?? 'Browser is unavailable.',
                state: 'unavailable',
            };
    }
}

export async function openBrowser(): Promise<AgentRuntimeBrowserActionResult> {
    const service = await requireBrowserService();
    await service.supervisor.startBrowser();
    await activateChrome();
    return agentRuntimeBrowserActionResultSchema.parse({
        message: null,
        ok: true,
        status: await service.supervisor.status(),
    });
}

export async function restartBrowser(): Promise<AgentRuntimeBrowserActionResult> {
    const service = await requireBrowserService();
    await service.supervisor.restartBrowser();
    return agentRuntimeBrowserActionResultSchema.parse({
        message: null,
        ok: true,
        status: await service.supervisor.status(),
    });
}

async function requireBrowserService() {
    await reconcileBrowserService();
    const service = getBrowserService();
    if (!service) {
        const capability = await checkBrowserCapability();
        throw new Error(capability.reason ?? 'Browser is unavailable.');
    }
    return service;
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
