import type { FastifyInstance } from 'fastify';
import type { ReminderSchedulerHealth } from './reminders/reminder-scheduler.ts';

export function registerGrottoHealth(
    app: FastifyInstance,
    postgresIsAvailable: () => Promise<boolean>,
    postgresTimeoutMs = 5000,
    reminderHealth?: () => ReminderSchedulerHealth
) {
    app.get('/healthz', async (_request, reply) => {
        const available = await Promise.race([
            postgresIsAvailable(),
            new Promise<false>((resolve) => setTimeout(() => resolve(false), postgresTimeoutMs)),
        ]);
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
