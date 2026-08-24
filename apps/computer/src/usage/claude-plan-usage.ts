import {
    type ClaudeUsageOptions,
    ClaudeUsageRequestError,
    type ClaudeUsageSnapshot,
    getClaudeUsage,
} from '@grotto/claude-usage';
import {
    readClaudePlanUsageState,
    saveClaudePlanUsageSnapshot,
    scheduleClaudeUsageFallback,
} from './claude-plan-usage-state.ts';

const DEFAULT_REFRESH_INTERVAL_MS = 15 * 60_000;
const DEFAULT_FALLBACK_DELAY_MS = 60 * 60_000;
const MAX_FALLBACK_DELAY_MS = 24 * 60 * 60_000;

export interface ClaudePlanUsageReadOptions extends ClaudeUsageOptions {
    dataRoot?: string;
}

export function createClaudePlanUsageReader(
    options: {
        fallbackDelayMs?: number;
        load?: (options: ClaudeUsageOptions) => Promise<ClaudeUsageSnapshot>;
        maxFallbackDelayMs?: number;
        refreshIntervalMs?: number;
    } = {}
) {
    const load = options.load ?? getClaudeUsage;
    const refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
    const fallbackDelayMs = options.fallbackDelayMs ?? DEFAULT_FALLBACK_DELAY_MS;
    const maxFallbackDelayMs = options.maxFallbackDelayMs ?? MAX_FALLBACK_DELAY_MS;
    let lastError: unknown = null;
    let lastSnapshot: ClaudeUsageSnapshot | null = null;
    let nextRequestAt = 0;
    let pending: Promise<ClaudeUsageSnapshot> | null = null;

    return async (readOptions: ClaudePlanUsageReadOptions = {}): Promise<ClaudeUsageSnapshot> => {
        const now = readOptions.now ?? new Date();
        if (readOptions.dataRoot) {
            const state = await readClaudePlanUsageState(readOptions.dataRoot);
            if (state.snapshot) {
                return state.snapshot;
            }
            if (now.getTime() < state.nextFallbackAt) {
                throw new ClaudeUsageRequestError(
                    'Claude plan usage is waiting for its guarded fallback retry.',
                    429,
                    state.nextFallbackAt - now.getTime()
                );
            }
        } else if (now.getTime() < nextRequestAt) {
            if (lastSnapshot) {
                return lastSnapshot;
            }
            throw lastError ?? new Error('Claude plan usage is waiting to retry.');
        }
        if (pending) {
            return pending;
        }

        pending = (async () => {
            const dataRoot = readOptions.dataRoot;
            const state = dataRoot ? await readClaudePlanUsageState(dataRoot) : null;
            if (dataRoot) {
                await scheduleClaudeUsageFallback(
                    dataRoot,
                    now.getTime() + refreshIntervalMs,
                    false
                );
            }
            try {
                const snapshot = await load(readOptions);
                lastError = null;
                lastSnapshot = snapshot;
                nextRequestAt = now.getTime() + refreshIntervalMs;
                if (dataRoot) {
                    await saveClaudePlanUsageSnapshot(dataRoot, snapshot, refreshIntervalMs);
                }
                return snapshot;
            } catch (error) {
                lastError = error;
                if (!(dataRoot || isTransientFailure(error))) {
                    lastSnapshot = null;
                    nextRequestAt = 0;
                    throw error;
                }
                const failures = (state?.fallbackFailures ?? 0) + 1;
                const exponentialDelay = Math.min(
                    maxFallbackDelayMs,
                    fallbackDelayMs * 2 ** Math.min(failures - 1, 10)
                );
                const retryAfter =
                    error instanceof ClaudeUsageRequestError && error.retryAfterMs !== null
                        ? error.retryAfterMs
                        : 0;
                const delay = Math.max(exponentialDelay, retryAfter, refreshIntervalMs);
                nextRequestAt = now.getTime() + delay;
                if (dataRoot) {
                    await scheduleClaudeUsageFallback(dataRoot, nextRequestAt, true);
                }
                if (lastSnapshot) {
                    return lastSnapshot;
                }
                throw error;
            } finally {
                pending = null;
            }
        })();
        return pending;
    };
}

export const readClaudePlanUsage = createClaudePlanUsageReader();

function isTransientFailure(error: unknown): boolean {
    return (
        error instanceof TypeError ||
        (error instanceof ClaudeUsageRequestError && (error.status === 429 || error.status >= 500))
    );
}
