import type { FastifyInstance } from 'fastify';

export function registerGrottoHealth(
    app: FastifyInstance,
    postgresIsAvailable: () => Promise<boolean>,
    postgresTimeoutMs = 5000
) {
    app.get('/healthz', async (_request, reply) => {
        const available = await Promise.race([
            postgresIsAvailable(),
            new Promise<false>((resolve) => setTimeout(() => resolve(false), postgresTimeoutMs)),
        ]);
        if (available) {
            return { status: 'ok' };
        }

        return reply.code(503).send({
            code: 'postgres_unavailable',
            status: 'unhealthy',
        });
    });
}
