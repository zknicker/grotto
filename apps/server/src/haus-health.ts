import { type EffectRuntime, settle } from '@haus/effect';
import { Effect } from 'effect';
import type { FastifyInstance } from 'fastify';
import type { ReminderSchedulerHealth } from './reminders/reminder-scheduler.ts';

export function registerHausHealth(
    app: FastifyInstance,
    runtime: EffectRuntime<never>,
    postgresIsAvailable: (signal?: AbortSignal) => Promise<boolean>,
    postgresTimeoutMs = 5000,
    reminderHealth?: () => ReminderSchedulerHealth
) {
    app.get('/healthz', async (_request, reply) => {
        const available = await settle(
            runtime,
            Effect.tryPromise({
                catch: () => false,
                try: (signal) => postgresIsAvailable(signal),
            }).pipe(
                Effect.timeoutTo({
                    duration: postgresTimeoutMs,
                    onSuccess: (result) => result,
                    onTimeout: () => false,
                })
            )
        );
        if (available) {
            const reminders = reminderHealth?.();
            if (reminders) {
                return {
                    reminders,
                    status: reminders.status === 'healthy' ? 'ok' : 'degraded',
                };
            }
            return { status: 'ok' };
        }

        return reply.code(503).send({
            code: 'postgres_unavailable',
            status: 'unhealthy',
        });
    });
}
