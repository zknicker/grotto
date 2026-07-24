import type {
    AgentRuntimeCapabilityHealth,
    AgentRuntimeCapabilityHealthId,
    AgentRuntimeCapabilityHealthState,
} from '@tavern/api';
import { checkBrowserCapability } from '../browser/settings.ts';
import { fallbackBinDirectories, findExecutable } from '../cli-path.ts';
import { AGENT_WORKSPACE } from '../config.ts';
import { isClerkConfigured } from '../identity/clerk-session.ts';
import { getOwner } from '../identity/members.ts';
import { loadClaudeSettings } from '../model-access/claude-settings.ts';
import { loadVaultBackedCodexCredentials } from '../model-access/codex-settings.ts';
import { hasHostClaudeLogin } from '../model-access/host-claude-login.ts';
import { listAgentModels } from '../models/catalog-service.ts';
import { resolveAgentModelSummary } from '../models/model-access.ts';
import { isDevToolkitEnabled } from '../tavern/development-turn-simulator.ts';

export interface RuntimeCapabilityCheckResult {
    metadata?: Record<string, unknown>;
    reason?: string | null;
    state: AgentRuntimeCapabilityHealthState;
    technicalMessage?: string | null;
}

export interface RuntimeCapabilityDefinition {
    check(): Promise<RuntimeCapabilityCheckResult> | RuntimeCapabilityCheckResult;
    displayName: string;
    id: AgentRuntimeCapabilityHealthId;
    refresh: {
        intervalMs: number;
        runOnStart: boolean;
    };
}

const minuteMs = 60 * 1000;

export const runtimeCapabilityDefinitions: RuntimeCapabilityDefinition[] = [
    {
        async check() {
            return checkClaudeModelAccessCapability();
        },
        displayName: 'Claude sign-in',
        id: 'claudeAuth',
        refresh: {
            intervalMs: 15 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkCodexModelAccessCapability();
        },
        displayName: 'Codex OAuth',
        id: 'codexOAuth',
        refresh: {
            intervalMs: 15 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkAgentEngineCapability({ capability: 'engine' });
        },
        displayName: 'Agent engine',
        id: 'dashboardServer',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkAgentEngineCapability({ capability: 'api' });
        },
        displayName: 'Agent engine API',
        id: 'apiServer',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkAgentEngineCapability({ capability: 'gateway' });
        },
        displayName: 'Agent connection',
        id: 'gateway',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkModelExecutionCapability();
        },
        displayName: 'Model execution',
        id: 'modelExecution',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return checkAgentEngineCapability({ capability: 'skills' });
        },
        displayName: 'Skills',
        id: 'skills',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkWebAccessCapability();
        },
        displayName: 'Web access',
        id: 'webAccess',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkIdentityCapability();
        },
        displayName: 'Identity',
        id: 'identity',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
    {
        check() {
            return checkDevToolkitCapability();
        },
        displayName: 'Dev toolkit',
        id: 'devToolkit',
        refresh: {
            intervalMs: 60 * minuteMs,
            runOnStart: true,
        },
    },
    {
        async check() {
            return await checkBrowserCapability();
        },
        displayName: 'Browser',
        id: 'browser',
        refresh: {
            intervalMs: 5 * minuteMs,
            runOnStart: true,
        },
    },
];

function checkIdentityCapability(): RuntimeCapabilityCheckResult {
    try {
        if (!isClerkConfigured()) {
            return {
                reason: 'Sign-in is not configured on this runtime.',
                state: 'unavailable',
            };
        }
        return getOwner()
            ? { state: 'healthy' }
            : {
                  reason: 'This runtime is unclaimed. The first sign-in claims it.',
                  state: 'degraded',
              };
    } catch (error) {
        return {
            reason: 'Identity is not ready.',
            state: 'unavailable',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

function checkWebAccessCapability(): RuntimeCapabilityCheckResult {
    // This makes older Runtimes read as unavailable to the app. Web fetch has no external
    // dependency; provider-native search readiness is a per-model fact.
    return { state: 'healthy' };
}

// Dev-stack-only helpers (simulated turns). Healthy only when the runtime
// was started by the development stack.
function checkDevToolkitCapability(): RuntimeCapabilityCheckResult {
    if (isDevToolkitEnabled()) {
        return { state: 'healthy' };
    }

    return {
        reason: 'The dev toolkit is only available on the development stack.',
        state: 'unavailable',
    };
}

function checkAgentEngineCapability(input: {
    capability: 'api' | 'engine' | 'gateway' | 'skills';
}): RuntimeCapabilityCheckResult {
    const model = resolveAgentModelSummary();
    const metadata = {
        capability: input.capability,
        model: model.model,
        provider: model.provider,
        workspace: AGENT_WORKSPACE,
    };

    return { metadata, state: 'healthy' };
}

async function checkModelExecutionCapability(): Promise<RuntimeCapabilityCheckResult> {
    const models = await listAgentModels();
    const available = models.models.filter((model) => model.availability === 'available');
    const metadata = {
        modelCount: models.models.length,
        providerCount: models.providers.length,
        providers: models.providers.map((provider) => provider.id),
    };

    if (available.length === 0) {
        return {
            metadata,
            reason: 'No executable agent model is configured.',
            state: 'unavailable',
        };
    }

    return { metadata, state: 'healthy' };
}

export function getRuntimeCapabilityDefinition(id: AgentRuntimeCapabilityHealthId) {
    const definition = runtimeCapabilityDefinitions.find((capability) => capability.id === id);
    if (!definition) {
        throw new Error(`Unknown Runtime capability: ${id}`);
    }
    return definition;
}

export function getExpectedRuntimeCapability(
    definition: RuntimeCapabilityDefinition
): AgentRuntimeCapabilityHealth {
    return {
        checkedAt: null,
        displayName: definition.displayName,
        healthy: false,
        id: definition.id,
        lastHealthyAt: null,
        metadata: {},
        nextCheckAt: null,
        reason: 'Capability has not been checked yet.',
        state: 'unknown',
        technicalMessage: null,
        updatedAt: null,
    };
}

function checkClaudeModelAccessCapability(): RuntimeCapabilityCheckResult {
    try {
        const settings = loadClaudeSettings();
        if (settings) {
            return {
                metadata: { account: settings.accountEmail, method: 'sign-in' },
                state: 'healthy',
            };
        }
        if (hasHostClaudeLogin()) {
            return {
                metadata: { method: 'Claude Code login' },
                state: 'healthy',
            };
        }
        return {
            reason: 'Claude is not connected. Connect Claude in Model access.',
            state: 'unauthorized',
        };
    } catch (error) {
        return {
            reason: 'Claude credentials could not be loaded.',
            state: 'unauthorized',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

async function checkCodexModelAccessCapability(): Promise<RuntimeCapabilityCheckResult> {
    try {
        if (!findExecutable('codex')) {
            return {
                reason: 'Codex CLI is not available to Grotto Runtime. Install codex or set TAVERN_AGENT_CODEX_CLI_COMMAND.',
                state: 'unavailable',
                technicalMessage: `Searched PATH and ${fallbackBinDirectories().join(', ')}.`,
            };
        }
        const credentials = await loadVaultBackedCodexCredentials();
        if (!credentials) {
            return {
                reason: 'Codex OAuth credentials are not configured.',
                state: 'unauthorized',
            };
        }
        return {
            metadata: {
                accountId: credentials.credentials.accountId,
                source: credentials.source,
            },
            state: 'healthy',
        };
    } catch (error) {
        return {
            reason: 'Codex OAuth credentials could not be loaded.',
            state: 'unauthorized',
            technicalMessage: error instanceof Error ? error.message : String(error),
        };
    }
}
