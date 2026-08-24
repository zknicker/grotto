import type { RuntimeTokenUsageSnapshot, UsageOverview } from '@grotto/api';
import { getCodexUsage } from '@grotto/codex-usage';
import { readClaudeLocalUsage } from './claude-local-usage.ts';
import { type ClaudePlanUsageReadOptions, readClaudePlanUsage } from './claude-plan-usage.ts';
import { readGrokLocalUsage } from './grok-local-usage.ts';
import { getGrokUsage } from './grok-usage.ts';
import { readOpenRouterUsage } from './openrouter-usage.ts';

export async function readComputerUsage(
    options: {
        loadClaudeUsage?: (
            options: ClaudePlanUsageReadOptions
        ) => ReturnType<typeof readClaudePlanUsage>;
        loadClaudeLocalUsage?: typeof readClaudeLocalUsage;
        loadCodexUsage?: typeof getCodexUsage;
        loadGrokLocalUsage?: typeof readGrokLocalUsage;
        loadGrokUsage?: typeof getGrokUsage;
        loadOpenRouterUsage?: typeof readOpenRouterUsage;
        dataRoot?: string;
        now?: () => Date;
        openRouterManagementKey?: string | null;
    } = {}
): Promise<UsageOverview> {
    const now = options.now?.() ?? new Date();
    const loadClaudeUsage = options.loadClaudeUsage ?? readClaudePlanUsage;
    const loadClaudeLocalUsage = options.loadClaudeLocalUsage ?? readClaudeLocalUsage;
    const loadCodexUsage = options.loadCodexUsage ?? getCodexUsage;
    const loadGrokLocalUsage = options.loadGrokLocalUsage ?? readGrokLocalUsage;
    const loadGrokUsage = options.loadGrokUsage ?? getGrokUsage;
    const loadOpenRouterUsage = options.loadOpenRouterUsage ?? readOpenRouterUsage;
    const [claude, codex, grok, openRouter, claudeLocal, grokLocal] = await Promise.all([
        loadClaudeUsage({ dataRoot: options.dataRoot, now })
            .then((snapshot) => ({
                provider: 'claude' as const,
                snapshot,
                status: 'ok' as const,
            }))
            .catch((cause: unknown) => ({
                error: sanitizedUsageError(cause, 'Claude usage is unavailable on this Computer.'),
                provider: 'claude' as const,
                status: 'error' as const,
            })),
        loadCodexUsage({ now })
            .then((snapshot) => ({
                provider: 'codex' as const,
                snapshot,
                status: 'ok' as const,
            }))
            .catch((cause: unknown) => ({
                error: sanitizedUsageError(cause, 'Codex usage is unavailable on this Computer.'),
                provider: 'codex' as const,
                status: 'error' as const,
            })),
        loadGrokUsage({ now })
            .then((snapshot) => ({
                provider: 'grok' as const,
                snapshot,
                status: 'ok' as const,
            }))
            .catch((cause: unknown) => ({
                error: sanitizedUsageError(cause, 'Grok usage is unavailable on this Computer.'),
                provider: 'grok' as const,
                status: 'error' as const,
            })),
        loadOpenRouterUsage(now, {
            managementApiKey: options.openRouterManagementKey,
        })
            .then((overview) => ({
                error: null,
                overview,
                status: 'ok' as const,
            }))
            .catch((cause: unknown) => ({
                error: sanitizedUsageError(
                    cause,
                    'OpenRouter usage is unavailable on this Computer.'
                ),
                overview: {
                    days: 0,
                    keys: [],
                    message: 'OpenRouter usage is unavailable.',
                    note: null,
                    series: [],
                    status: 'empty' as const,
                    totalByokUsageUsd: 0,
                    totalRequests: 0,
                    totalUsageUsd: 0,
                },
                status: 'error' as const,
            })),
        readRuntimeUsageState('claude-code', () => loadClaudeLocalUsage({ now })),
        readRuntimeUsageState('grok-build', () => loadGrokLocalUsage({ now })),
    ]);
    const connectedProviders: UsageOverview['connectedProviders'] = [];
    if (claude.status === 'ok' || claudeLocal?.status === 'ok') {
        connectedProviders.push('claude-code');
    }
    if (codex.status === 'ok') {
        connectedProviders.push('openai-codex');
    }
    if (grok.status === 'ok' || grokLocal?.status === 'ok') {
        connectedProviders.push('grok-build');
    }
    if (openRouter.status === 'ok' && openRouter.overview.status !== 'unconfigured') {
        connectedProviders.push('openrouter');
    }

    return {
        capturedAt: now.toISOString(),
        claude,
        codex,
        connectedProviders,
        grok,
        openRouter,
        runtimeUsage: [claudeLocal, grokLocal].filter(
            (state): state is NonNullable<typeof state> => state !== null
        ),
    };
}

async function readRuntimeUsageState(
    runtimeId: 'claude-code' | 'grok-build',
    load: () => Promise<RuntimeTokenUsageSnapshot | null>
): Promise<UsageOverview['runtimeUsage'][number] | null> {
    try {
        const snapshot = await load();
        return snapshot ? { runtimeId, snapshot, status: 'ok' } : null;
    } catch (cause) {
        return {
            error: sanitizedUsageError(cause, `${runtimeId} token usage is unavailable.`),
            runtimeId,
            status: 'error',
        };
    }
}

function sanitizedUsageError(cause: unknown, message: string) {
    const rawMessage = cause instanceof Error ? cause.message : '';
    const errorName = cause instanceof Error ? cause.name : '';
    const isAuthenticationFailure =
        errorName.includes('Auth') ||
        /\b(auth|authentication|credential|login|signed out)\b/i.test(rawMessage) ||
        rawMessage.includes('rejected the Computer management key');
    const code = isAuthenticationFailure
        ? ('auth' as const)
        : errorName.includes('Parse') || errorName === 'ZodError'
          ? ('parse' as const)
          : cause instanceof TypeError ||
              rawMessage.includes('HTTP') ||
              rawMessage.includes('status')
            ? ('request' as const)
            : ('unknown' as const);

    return {
        code,
        message,
        name: 'UsageError',
    };
}
