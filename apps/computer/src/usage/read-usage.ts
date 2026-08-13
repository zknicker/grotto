import type { UsageOverview } from '@tavern/api';
import { getCodexUsage } from '@tavern/codex-usage';
import { readOpenRouterUsage } from './openrouter-usage.ts';

export async function readComputerUsage(
    options: {
        loadCodexUsage?: typeof getCodexUsage;
        loadOpenRouterUsage?: typeof readOpenRouterUsage;
        now?: () => Date;
        openRouterManagementKey?: string | null;
    } = {}
): Promise<UsageOverview> {
    const now = options.now?.() ?? new Date();
    const loadCodexUsage = options.loadCodexUsage ?? getCodexUsage;
    const loadOpenRouterUsage = options.loadOpenRouterUsage ?? readOpenRouterUsage;
    const codex = await loadCodexUsage({ now })
        .then((snapshot) => ({
            provider: 'codex' as const,
            snapshot,
            status: 'ok' as const,
        }))
        .catch((cause: unknown) => ({
            error: sanitizedUsageError(cause, 'Codex usage is unavailable on this Computer.'),
            provider: 'codex' as const,
            status: 'error' as const,
        }));
    const openRouter = await loadOpenRouterUsage(now, {
        managementApiKey: options.openRouterManagementKey,
    })
        .then((overview) => ({
            error: null,
            overview,
            status: 'ok' as const,
        }))
        .catch((cause: unknown) => ({
            error: sanitizedUsageError(cause, 'OpenRouter usage is unavailable on this Computer.'),
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
        }));
    const connectedProviders: UsageOverview['connectedProviders'] = [];
    if (codex.status === 'ok') {
        connectedProviders.push('openai-codex');
    }
    if (openRouter.status === 'ok' && openRouter.overview.status !== 'unconfigured') {
        connectedProviders.push('openrouter');
    }

    return {
        capturedAt: now.toISOString(),
        codex,
        connectedProviders,
        openRouter,
    };
}

function sanitizedUsageError(cause: unknown, message: string) {
    const rawMessage = cause instanceof Error ? cause.message : '';
    const code = rawMessage.includes('rejected the Computer management key')
        ? ('auth' as const)
        : rawMessage.includes('status')
          ? ('request' as const)
          : cause instanceof Error && cause.name === 'ZodError'
            ? ('parse' as const)
            : ('unknown' as const);

    return {
        code,
        message,
        name: 'UsageError',
    };
}
