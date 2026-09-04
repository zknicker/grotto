/** Burst ceiling: at most this many fires per trigger in {@link triggerBurstWindowMs}. */
export const triggerBurstLimit = 10;
export const triggerBurstWindowMs = 10_000;
/** Sustained ceiling: at most this many fires per trigger per rolling hour. */
export const triggerHourlyLimit = 60;
export const triggerHourlyWindowMs = 3_600_000;
/** Above this many tracked triggers the limiter sweeps expired entries. */
const sweepThreshold = 1000;

/**
 * Per-trigger inbound rate limit. The Grotto Server is a single node, so the
 * window lives in memory: a restart forgets it, which only ever admits traffic
 * the ceilings would have admitted a window later.
 */
export class TriggerRateLimiter {
    private readonly fires = new Map<string, number[]>();

    /**
     * Records one fire and returns null, or returns how many seconds the caller
     * should wait when either ceiling is already reached.
     */
    admit(triggerId: string, now: number): { retryAfterSeconds: number } | null {
        if (this.fires.size >= sweepThreshold) {
            this.sweep(now);
        }
        const recent = (this.fires.get(triggerId) ?? []).filter(
            (at) => at > now - triggerHourlyWindowMs
        );
        const burst = recent.filter((at) => at > now - triggerBurstWindowMs);
        const refusal =
            burst.length >= triggerBurstLimit
                ? retryAfter(burst[0] + triggerBurstWindowMs, now)
                : recent.length >= triggerHourlyLimit
                  ? retryAfter(recent[0] + triggerHourlyWindowMs, now)
                  : null;
        this.fires.set(triggerId, refusal ? recent : [...recent, now]);
        return refusal;
    }

    private sweep(now: number): void {
        for (const [triggerId, fires] of this.fires) {
            const newest = fires.at(-1);
            if (newest === undefined || newest <= now - triggerHourlyWindowMs) {
                this.fires.delete(triggerId);
            }
        }
    }
}

function retryAfter(availableAt: number, now: number) {
    return { retryAfterSeconds: Math.max(1, Math.ceil((availableAt - now) / 1000)) };
}
