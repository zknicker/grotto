import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify, { type FastifyInstance } from 'fastify';
import { createGrottoContextFactory } from './grotto-api/context.ts';
import { grottoRouter } from './grotto-api/router.ts';
import { startGrottoWebSocketServer } from './grotto-api/ws.ts';
import { createClerkSessions } from './identity/clerk-sessions.ts';
import { type ClerkUsers, createClerkUsers } from './identity/clerk-users.ts';
import { isAllowedAppOrigin } from './origin.ts';
import { connectGrottoDatabase } from './postgres/connection.ts';
import type { ReminderClock } from './reminders/reminder-model.ts';
import {
    createHostedReminderScheduler,
    type HostedReminderScheduler,
    type ReminderSchedulerTimers,
} from './reminders/reminder-scheduler.ts';
import { tickHostedReminders } from './reminders/scheduler.ts';

/**
 * The hosted Grotto Server. It serves only the Grotto Server contract over
 * HTTP and WebSocket, backed by PostgreSQL and Clerk. The pre-WS6 local
 * sidecar is a separate application with its own router and SQLite database.
 */
export interface GrottoServerApplicationOptions {
    appOrigin: string;
    /** Clerk Backend API origin; defaults to Clerk's production endpoint. */
    clerkApiUrl?: string;
    /** Origin of the Clerk instance that authenticates humans. */
    clerkIssuerUrl: string;
    /** Clerk secret for the verified-email lookup invitations depend on. */
    clerkSecretKey?: string;
    /** Overrides the Clerk verified-email boundary; tests stand in for it. */
    clerkUsers?: ClerkUsers;
    /** PostgreSQL database owning Users, Servers, memberships, and Channels. */
    databaseUrl: string;
    /** Controlled time seam for deterministic reminder lifecycle tests. */
    reminderClock?: ReminderClock;
    /** Timer seam; production uses the process interval. */
    reminderSchedulerTimers?: ReminderSchedulerTimers;
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
    let reminderScheduler: HostedReminderScheduler | null = null;

    try {
        const createContext = createGrottoContextFactory({
            clerkSessions: createClerkSessions(options.clerkIssuerUrl, options.appOrigin),
            clerkUsers:
                options.clerkUsers ??
                createClerkUsers({
                    apiUrl: options.clerkApiUrl,
                    secretKey: options.clerkSecretKey,
                }),
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

        const startedApp = app;
        const webSocketServer = startGrottoWebSocketServer(startedApp.server, {
            createContext,
            isAllowedOrigin,
        });
        const reminderClock = options.reminderClock ?? { now: () => new Date() };
        reminderScheduler = createHostedReminderScheduler({
            clock: reminderClock,
            tick: () => tickHostedReminders(grotto.db, reminderClock),
            timers: options.reminderSchedulerTimers,
        });
        await reminderScheduler.start();

        app.get('/healthz', async () => {
            const reminders = reminderScheduler?.health() ?? {
                consecutiveFailures: 1,
                lastSuccessfulTickAt: null,
                status: 'degraded' as const,
            };
            return {
                reminders,
                status: reminders.status === 'healthy' ? 'ok' : 'degraded',
            };
        });

        let closePromise: Promise<void> | null = null;
        const close = () => {
            closePromise ??= (async () => {
                webSocketServer.broadcastReconnectNotification();
                webSocketServer.close();
                startedApp.server.closeAllConnections();
                await reminderScheduler?.close();
                await startedApp.close();
                await grotto.close();
            })();
            return closePromise;
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
        await reminderScheduler?.close().catch(() => undefined);
        await app?.close().catch(() => undefined);
        await grotto.close().catch(() => undefined);
        throw cause;
    }
}
