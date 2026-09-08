import type { AgentDeliveryRow } from './store.ts';

export const maxDeliveryFailures = 5;
const failureBackoffBaseMs = 5000;
const failureBackoffCapMs = 60_000;

export function isBackedOff(state: AgentDeliveryRow): boolean {
    if (state.consecutiveFailures >= maxDeliveryFailures) {
        return true;
    }
    return state.retryAfter !== null && state.retryAfter.getTime() > Date.now();
}

export function nextRetryAt(failures: number): Date {
    const backoff = Math.min(failureBackoffCapMs, failureBackoffBaseMs * 2 ** (failures - 1));
    return new Date(Date.now() + backoff);
}
