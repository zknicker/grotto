import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAgentApiRoutes } from './agent-api/routes.ts';
import { AgentDelivery } from './agent-delivery/delivery.ts';
import { startDeliveryRetrySweep } from './agent-delivery/retry-sweep.ts';
import { openAttachmentRoot } from './attachments/attachment-root.ts';
import { registerAttachmentRoutes } from './attachments/attachment-routes.ts';
import { reconcileAttachments } from './attachments/reconcile-attachments.ts';
import {
    type AvatarGenerationLogger,
    type AvatarImageProvider,
    AvatarImageService,
    OpenAiAvatarImageProvider,
} from './avatar-generation/index.ts';
import { registerAvatarRoutes } from './avatars/avatar-routes.ts';
import { purgeDeletedChannels } from './chats/channel-lifecycle.ts';
import { ComputerConnections } from './computers/connections.ts';
import { registerComputerRoutes } from './computers/routes.ts';
import { markAllComputersOffline } from './computers/service.ts';
import { startComputerAttachmentSocket } from './computers/socket.ts';
import { productionComputerManifestUrl } from './computers/update.ts';
import { createGrottoContextFactory } from './grotto-api/context.ts';
import { grottoRouter } from './grotto-api/router.ts';
import { startGrottoWebSocketServer } from './grotto-api/ws.ts';
import { registerGrottoHealth } from './grotto-health.ts';
import type { GrottoReleaseIdentity } from './grotto-release-identity.ts';
import { registerGrottoReleaseRoute } from './grotto-release-route.ts';
import { registerGrottoStaticApp } from './grotto-static-app.ts';
import { createClerkSessions } from './identity/clerk-sessions.ts';
import { type ClerkUsers, createClerkUsers } from './identity/clerk-users.ts';
import { isAllowedAppOrigin } from './origin.ts';
import { connectGrottoDatabase } from './postgres/connection.ts';
import { registerPreparedActionMediaRoutes } from './prepared-actions/media.ts';
import type { ReminderClock } from './reminders/reminder-model.ts';
import {
    createReminderScheduler,
    type ReminderScheduler,
    type ReminderSchedulerTimers,
} from './reminders/reminder-scheduler.ts';
import { tickReminders } from './reminders/scheduler.ts';
import { registerMcpOAuthCallback } from './server-mcp/oauth-callback-route.ts';
import { McpOAuthRelay } from './server-mcp/oauth-relay.ts';
import { McpRuntime } from './server-mcp/runtime.ts';
import { purgeDeletedServers } from './servers/delete-server.ts';

/**
 * The Grotto Server. It serves only the Grotto Server contract over
 * HTTP and WebSocket, backed by PostgreSQL and Clerk.
 */
export interface GrottoServerApplicationOptions {
    appOrigin: string;
    /** Absolute private root for Server-owned attachment bytes. */
    attachmentRoot: string;
    /** Safe operational logger for transient avatar generation. */
    avatarGenerationLogger?: AvatarGenerationLogger;
    /** Testable Server-owned image provider; production uses OpenAI when configured. */
    avatarImageProvider?: AvatarImageProvider;
    /** Clerk Backend API origin; defaults to Clerk's production endpoint. */
    clerkApiUrl?: string;
    /** Origin of the Clerk instance that authenticates humans. */
    clerkIssuerUrl: string;
    /** Clerk secret for the verified-email lookup invitations depend on. */
    clerkSecretKey?: string;
    /** Overrides the Clerk verified-email boundary; tests stand in for it. */
    clerkUsers?: ClerkUsers;
    /** Signed latest-production Computer release descriptor. */
    computerReleaseManifestUrl?: string;
    /** PostgreSQL database owning Users, Servers, memberships, and Channels. */
    databaseUrl: string;
    /** Server-owned OpenAI key; omitted when avatar generation is unavailable. */
    openAiApiKey?: string;
    /** Exact identity of the running release; absent for an ordinary development Server. */
    releaseIdentity?: GrottoReleaseIdentity | null;
    /** Controlled time seam for deterministic reminder lifecycle tests. */
    reminderClock?: ReminderClock;
    /** Timer seam; production uses the process interval. */
    reminderSchedulerTimers?: ReminderSchedulerTimers;
    /** Built Grotto App assets. Omit only when another process serves the App in development. */
    staticAppRoot?: string;
}

export interface GrottoServerApplication {
    app: FastifyInstance;
    close(): Promise<void>;
    /** Binds the Server's port, closing the application if the bind fails. */
    listen(port: number): Promise<void>;
}

/**
 * tRPC batches every procedure name into one path segment, so the App's opening
 * batch runs past Fastify's 100-character `maxParamLength` default and 404s
 * instead of routing — intermittently leaving whole destinations without data.
 */
export const grottoFastifyOptions = {
    bodyLimit: 12 * 1024 * 1024,
    logger: false,
    maxParamLength: 5000,
} as const;

export async function createGrottoServerApplication(
    options: GrottoServerApplicationOptions
): Promise<GrottoServerApplication> {
    const grotto = await connectGrottoDatabase(options.databaseUrl);
    let app: FastifyInstance | null = null;
    let reminderScheduler: ReminderScheduler | null = null;

    try {
        const attachmentRoot = await openAttachmentRoot(options.attachmentRoot);
        await reconcileAttachments(grotto.db, attachmentRoot);
        await purgeDeletedChannels(grotto.db, attachmentRoot);
        await purgeDeletedServers(grotto.db, attachmentRoot);
        await markAllComputersOffline(grotto.db);
        const clerkSessions = createClerkSessions(options.clerkIssuerUrl, options.appOrigin);
        const computerConnections = new ComputerConnections();
        const agentDelivery = new AgentDelivery(grotto.db, computerConnections);
        const avatarImageService = new AvatarImageService(
            options.avatarImageProvider ??
                new OpenAiAvatarImageProvider({ apiKey: options.openAiApiKey }),
            options.avatarGenerationLogger
        );
        const mcpRuntime = new McpRuntime(grotto.db);
        const mcpOAuthRelay = new McpOAuthRelay(grotto.db, mcpRuntime);
        const createContext = createGrottoContextFactory({
            agentDelivery,
            appOrigin: options.appOrigin,
            attachmentRoot,
            avatarImageService,
            clerkSessions,
            clerkUsers:
                options.clerkUsers ??
                createClerkUsers({
                    apiUrl: options.clerkApiUrl,
                    secretKey: options.clerkSecretKey,
                }),
            computerConnections,
            computerReleaseManifestUrl:
                options.computerReleaseManifestUrl ?? productionComputerManifestUrl,
            grottoDb: grotto.db,
            mcpOAuthRelay,
            mcpRuntime,
        });
        const isAllowedOrigin = (origin: string | undefined) =>
            isAllowedAppOrigin(origin, options.appOrigin);

        app = Fastify(grottoFastifyOptions);

        await app.register(cors, {
            credentials: true,
            methods: ['GET', 'HEAD', 'POST', 'PUT'],
            origin: (origin, callback) => {
                callback(null, isAllowedOrigin(origin));
            },
        });

        await registerAttachmentRoutes(app, {
            clerkSessions,
            db: grotto.db,
            root: attachmentRoot,
        });
        registerAvatarRoutes(app, { db: grotto.db });
        registerPreparedActionMediaRoutes(app, { db: grotto.db });
        registerComputerRoutes(app, { appOrigin: options.appOrigin, db: grotto.db });
        registerAgentApiRoutes(app, {
            agentDelivery,
            avatarImageService,
            attachmentRoot,
            db: grotto.db,
            mcpRuntime,
        });
        registerMcpOAuthCallback(app, mcpOAuthRelay);
        registerGrottoReleaseRoute(app, { releaseIdentity: options.releaseIdentity });

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
        const computerSocket = startComputerAttachmentSocket(
            startedApp.server,
            grotto.db,
            computerConnections,
            agentDelivery
        );
        const deliveryRetrySweep = startDeliveryRetrySweep(agentDelivery);
        const reminderClock = options.reminderClock ?? { now: () => new Date() };
        reminderScheduler = createReminderScheduler({
            clock: reminderClock,
            tick: () => tickReminders(grotto.db, reminderClock, agentDelivery),
            timers: options.reminderSchedulerTimers,
        });
        await reminderScheduler.start();

        registerGrottoHealth(app, grotto.health, 5000, () => {
            return (
                reminderScheduler?.health() ?? {
                    consecutiveFailures: 1,
                    lastSuccessfulTickAt: null,
                    status: 'degraded' as const,
                }
            );
        });

        if (options.staticAppRoot) {
            await registerGrottoStaticApp(app, options.staticAppRoot);
        }

        let closePromise: Promise<void> | null = null;
        const close = () => {
            closePromise ??= (async () => {
                webSocketServer.broadcastReconnectNotification();
                webSocketServer.close();
                deliveryRetrySweep.close();
                computerSocket.close();
                startedApp.server.closeAllConnections();
                await reminderScheduler?.close();
                await mcpRuntime.close();
                await startedApp.close();
                await grotto.close();
            })();
            return closePromise;
        };

        return {
            app: startedApp,
            close,
            listen: async (port) => {
                try {
                    await startedApp.listen({ host: '127.0.0.1', port });
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
