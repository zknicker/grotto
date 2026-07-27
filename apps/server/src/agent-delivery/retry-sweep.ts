import type { AgentDelivery } from './delivery.ts';

const sweepIntervalMs = 2000;

export interface DeliveryRetrySweep {
    close(): void;
}

/**
 * Periodically resends unacknowledged deliveries and drains any pending inbox
 * left behind an offline Computer. Reconnect handles the common case; this sweep
 * covers a Computer that stays attached but dropped a start frame, and re-drives
 * work that could not dispatch while its Computer was offline.
 */
export function startDeliveryRetrySweep(delivery: AgentDelivery): DeliveryRetrySweep {
    let running = false;
    const timer = setInterval(() => {
        if (running) {
            return;
        }
        running = true;
        void delivery
            .sweep()
            .catch(() => undefined)
            .finally(() => {
                running = false;
            });
    }, sweepIntervalMs);
    timer.unref?.();
    return { close: () => clearInterval(timer) };
}
