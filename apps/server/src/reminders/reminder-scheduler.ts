import type { ReminderClock } from './reminder-model.ts';

export interface ReminderSchedulerHealth {
    consecutiveFailures: number;
    lastSuccessfulTickAt: string | null;
    status: 'degraded' | 'healthy' | 'stopped';
}

export interface ReminderSchedulerTimers {
    clearInterval(timer: ReturnType<typeof setInterval>): void;
    setInterval(callback: () => void, milliseconds: number): ReturnType<typeof setInterval>;
}

export interface ReminderScheduler {
    close(): Promise<void>;
    health(): ReminderSchedulerHealth;
    start(): Promise<void>;
    wake(): Promise<void>;
}

export function createReminderScheduler(options: {
    clock: ReminderClock;
    intervalMs?: number;
    tick(): Promise<unknown>;
    timers?: ReminderSchedulerTimers;
}): ReminderScheduler {
    const timers = options.timers ?? defaultTimers;
    let consecutiveFailures = 0;
    let lastSuccessfulTickAt: string | null = null;
    let inFlight: Promise<void> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let closing = false;
    let started = false;

    const wake = () => {
        if (inFlight) {
            return inFlight;
        }
        if (closing) {
            return Promise.resolve();
        }
        inFlight = options
            .tick()
            .then(() => {
                consecutiveFailures = 0;
                lastSuccessfulTickAt = options.clock.now().toISOString();
            })
            .catch(() => {
                consecutiveFailures += 1;
            })
            .finally(() => {
                inFlight = null;
            });
        return inFlight;
    };

    return {
        async close() {
            closing = true;
            if (interval) {
                timers.clearInterval(interval);
                interval = null;
            }
            await inFlight;
        },
        health() {
            return {
                consecutiveFailures,
                lastSuccessfulTickAt,
                status:
                    closing || !started
                        ? ('stopped' as const)
                        : consecutiveFailures === 0
                          ? ('healthy' as const)
                          : ('degraded' as const),
            };
        },
        async start() {
            if (started) {
                return;
            }
            started = true;
            interval = timers.setInterval(() => {
                void wake();
            }, options.intervalMs ?? 15_000);
            await wake();
        },
        wake,
    };
}

const defaultTimers: ReminderSchedulerTimers = {
    clearInterval: (timer) => clearInterval(timer),
    setInterval: (callback, milliseconds) => setInterval(callback, milliseconds),
};
