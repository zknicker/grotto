import { type DefaultOptions, keepPreviousData } from '@tanstack/react-query';
import { shouldRetryQuery } from './query-retry.ts';

const THIRTY_SECONDS_MS = 30_000;
const FIVE_MINUTES_MS = 5 * 60_000;
const THIRTY_MINUTES_MS = 30 * 60_000;

const stableQueryPolicy = {
    gcTime: THIRTY_MINUTES_MS,
} as const;

export const queryPolicy = {
    localConfig: {
        ...stableQueryPolicy,
        staleTime: FIVE_MINUTES_MS,
    },
    agentRuntimeSnapshot: {
        ...stableQueryPolicy,
        staleTime: THIRTY_SECONDS_MS,
    },
    runtimeModelSnapshot: {
        ...stableQueryPolicy,
        placeholderData: keepPreviousData,
        staleTime: FIVE_MINUTES_MS,
    },
    syncedSnapshot: {
        ...stableQueryPolicy,
        staleTime: THIRTY_SECONDS_MS,
    },
    volatileState: {
        refetchOnMount: false,
        staleTime: 0,
    },
} as const;

export const queryClientDefaultOptions = {
    queries: {
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        staleTime: THIRTY_SECONDS_MS,
    },
} satisfies DefaultOptions;
