import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify, { type FastifyInstance } from 'fastify';
import { createGrottoContextFactory } from './grotto-api/context.ts';
import { grottoRouter } from './grotto-api/router.ts';
import { startGrottoWebSocketServer } from './grotto-api/ws.ts';
import { createClerkSessions } from './identity/clerk-sessions.ts';
import { isAllowedAppOrigin } from './origin.ts';
import { connectGrottoDatabase } from './postgres/connection.ts';

/**
 * The hosted Grotto Server. It serves only the Grotto Server contract over
 * HTTP and WebSocket, backed by PostgreSQL and Clerk. The pre-WS6 local
 * sidecar is a separate application with its own router and SQLite database.
 */
export interface GrottoServerApplicationOptions {
    appOrigin: string;
    /** Origin of the Clerk instance that authenticates humans. */
    clerkIssuerUrl: string;
    /** PostgreSQL database owning Users, Servers, memberships, and Channels. */
    databaseUrl: string;
}

export interface GrottoServerApplication {
    app: FastifyInstance;
    close(): Promise<void>;
    /** Binds the Server's port, closing the application if the bind fails. */
    listen(port: number): Promise<void>;
}

export async function createGrottoServerApplication(
    options: GrottoServerApplicationOptions
): Promise<GrottoServerApplication> {
    const grotto = await connectGrottoDatabase(options.databaseUrl);
    let app: FastifyInstance | null = null;

    try {
        const createContext = createGrottoContextFactory({
            clerkSessions: createClerkSessions(options.clerkIssuerUrl),
            grottoDb: grotto.db,
        });
        const isAllowedOrigin = (origin: string | undefined) =>
            isAllowedAppOrigin(origin, options.appOrigin);

        app = Fastify({
            bodyLimit: 12 * 1024 * 1024,
            logger: false,
        });

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
                createContext,
                router: grottoRouter,
            },
        });

        app.get('/healthz', async () => ({
            status: 'ok',
        }));

        const startedApp = app;
        const webSocketServer = startGrottoWebSocketServer(startedApp.server, {
            createContext,
            isAllowedOrigin,
        });

        const close = async () => {
            webSocketServer.broadcastReconnectNotification();
            webSocketServer.close();
            startedApp.server.closeAllConnections();
            await startedApp.close();
            await grotto.close();
        };

        return {
            app: startedApp,
            close,
            listen: async (port: number) => {
                try {
                    await startedApp.listen({ host: '0.0.0.0', port });
                } catch (cause) {
                    // A failed bind leaves the application and its PostgreSQL
                    // pool open; the bind error is the useful one.
                    await close().catch(() => undefined);
                    throw cause;
                }
            },
        };
    } catch (cause) {
        // The original failure is the useful one; teardown must not mask it.
        await app?.close().catch(() => undefined);
        await grotto.close().catch(() => undefined);
        throw cause;
    }
}
