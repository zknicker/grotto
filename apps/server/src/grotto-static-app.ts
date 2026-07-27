import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

export async function registerGrottoStaticApp(app: FastifyInstance, staticAppRoot: string) {
    await app.register(fastifyStatic, {
        root: staticAppRoot,
    });

    app.setNotFoundHandler((request, reply) => {
        if (request.method === 'GET' && request.headers.accept?.includes('text/html')) {
            return reply.sendFile('index.html');
        }

        return reply.code(404).send({
            error: 'Not Found',
            message: `Route ${request.method}:${request.url} not found`,
            statusCode: 404,
        });
    });
}
