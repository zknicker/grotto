import {
    refreshAgentRuntimeEventSync,
    startAgentRuntimeEventSync,
} from './agent-runtime/event-sync.ts';
import {
    confirmAgentRuntimeConnection,
    getCurrentAgentRuntimeUrl,
    loadAgentRuntimeConnection,
} from './agent-runtime-connection/service.ts';
import { apiEventSchedulerIntervals, startApiEventScheduler } from './api/events-scheduler.ts';
import { emitAgentRuntimeUpdated } from './api/invalidation-events.ts';
import { env } from './config/env.ts';
import { ensureDatabaseSchema } from './db/bootstrap.ts';
import { startOrphanExitWatch } from './dev/orphan-exit-watch.ts';
import { startJobsManager } from './jobs/manager.ts';
import { createServerApplication, type ServerApplication } from './server-application.ts';
import {
    formatDurationMs,
    logStartupBanner,
    logStartupComplete,
    logStartupDetail,
    logStartupFailure,
    logStartupSection,
    shortenHomePath,
} from './startup-log.ts';
import { listConfiguredAgentRuntimeConnections } from './storage/agent-runtime-connections.ts';
import { syncAgentRuntimeAgents } from './sync/agent-runtime-sync.ts';

async function start() {
    startOrphanExitWatch({
        enabled: process.env.TAVERN_EXIT_ON_ORPHAN === '1',
        exit: (code) => {
            process.exit(code);
        },
        getParentPid: () => process.ppid,
    });

    logStartupBanner('🟠 Grotto Server', 'Booting Grotto Runtime services');
    await ensureDatabaseSchema();
    await loadAgentRuntimeConnection({ refreshStatus: false });

    const application = await createServerApplication({
        appOrigin: env.APP_ORIGIN,
    });

    await application.app.listen({
        host: '0.0.0.0',
        port: env.SERVER_PORT,
    });

    await startJobsManager();
    registerShutdown(application);
    startApiEventScheduler();
    startAgentRuntimeEventSync();
    void refreshRuntimeAfterStartup();
    const configuredAgentRuntimeCount = (await listConfiguredAgentRuntimeConnections()).length;

    logStartupSection('Grotto Runtime');
    logStartupDetail('🗄️', 'Database', shortenHomePath(env.DATABASE_PATH));
    logStartupDetail('🌐', 'Server UI origin', env.APP_ORIGIN);
    logStartupDetail('📡', 'HTTP', `http://localhost:${env.SERVER_PORT}`);
    logStartupDetail('🔌', 'WebSocket', `ws://localhost:${env.SERVER_PORT}/trpc`);
    logStartupDetail('🎮', 'Grotto Runtime', getCurrentAgentRuntimeUrl() ?? 'disabled');
    logStartupDetail(
        '👀',
        'Runtime observe',
        configuredAgentRuntimeCount > 0
            ? `${configuredAgentRuntimeCount} connection(s); refreshing`
            : 'degraded'
    );
    logStartupDetail(
        '⏱️',
        'Usage refresh',
        formatDurationMs(apiEventSchedulerIntervals.usageIntervalMs)
    );
    logStartupComplete('Grotto is ready');
}

function registerShutdown(application: ServerApplication) {
    process.once('SIGTERM', () => {
        void application.close().catch((error) => {
            console.error('[tavern] failed to close Grotto Server', error);
        });
    });
}

const startupRuntimeConfirmRetryMs = 2000;
const startupRuntimeConfirmAttempts = 30;

async function refreshRuntimeAfterStartup() {
    // The runtime can still be booting when the server comes up (the dev
    // stack and e2e harness start both processes in parallel), so keep
    // confirming until it answers, then attach runtime event sync.
    let agentRuntimeReachable = false;

    for (let attempt = 0; attempt < startupRuntimeConfirmAttempts; attempt += 1) {
        agentRuntimeReachable = await confirmAgentRuntimeConnection().catch((error) => {
            console.warn('[tavern] failed to refresh runtime capabilities', error);
            return false;
        });

        if (agentRuntimeReachable || !getCurrentAgentRuntimeUrl()) {
            break;
        }

        await new Promise((resolve) => setTimeout(resolve, startupRuntimeConfirmRetryMs));
    }

    refreshAgentRuntimeEventSync();
    emitAgentRuntimeUpdated();

    if (!agentRuntimeReachable) {
        return;
    }

    await syncAgentRuntimeAgents().catch((error) => {
        console.warn('[tavern] failed to sync runtime agents on startup', error);
    });
}

start().catch((error) => {
    logStartupFailure('Grotto boot failed');
    console.error(error);
    process.exitCode = 1;
});
