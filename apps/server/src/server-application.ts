import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify, { type FastifyInstance } from 'fastify';
import { createApiContext } from './api/context.ts';
import { appRouter } from './api/router.ts';
import { startTrpcWebSocketServer } from './api/ws.ts';
import { isAllowedAppOrigin } from './origin.ts';

export interface ServerApplicationOptions {
    appOrigin: string;
}

export interface ServerApplication {
    app: FastifyInstance;
    close(): Promise<void>;
}

export async function createServerApplication(
    options: ServerApplicationOptions
): Promise<ServerApplication> {
    const app = Fastify({
        bodyLimit: 12 * 1024 * 1024,
        logger: false,
    });
    const isAllowedOrigin = (origin: string | undefined) =>
        isAllowedAppOrigin(origin, options.appOrigin);

    await app.register(cors, {
        origin: (origin, callback) => {
            callback(null, isAllowedOrigin(origin));
        },
        credentials: true,
    });

    await app.register(fastifyTRPCPlugin, {
        prefix: '/trpc',
        trpcOptions: {
            allowMethodOverride: true,
            createContext: createApiContext,
            router: appRouter,
        },
    });

    app.get('/healthz', async () => ({
        status: 'ok',
    }));

    const webSocketServer = startTrpcWebSocketServer(app.server, {
        isAllowedOrigin,
    });

    return {
        app,
        close: async () => {
            webSocketServer.broadcastReconnectNotification();
            webSocketServer.close();
            app.server.closeAllConnections();
            await app.close();
        },
    };
}
