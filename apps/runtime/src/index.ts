import path from 'node:path';
import { setAgentCliServerUrl } from './agent-engine/agent-cli-wrapper.ts';
import { closeAllMcpClients } from './agent-engine/mcp-clients.ts';
import { seededSkillDefaultEntries, seedManagedSkills } from './agent-engine/skill-library.ts';
import { setBrowserStatusListener, stopBrowserService } from './browser/service.ts';
import { reconcileBrowserService } from './browser/settings.ts';
import { refreshRuntimeCapabilities } from './capabilities/store.ts';
import { dispatch } from './cli/main.ts';
import { ensureCliOnPath } from './cli-path.ts';
import { DATA_DIR } from './config.ts';
import { initDb } from './db/connection.ts';
import { ensureRuntimeSchema } from './db/schema.ts';
import { runRuntimeDoctor } from './doctor/runtime-doctor.ts';
import { type RuntimeJobsManager, startRuntimeJobsManager } from './jobs/manager.ts';
import { ensureRuntimeJobsSchema } from './jobs/schema.ts';
import { log } from './log.ts';
import { recordSkillSource, sha256 } from './skills/store.ts';
import { wakeAgent } from './tavern/agent-turn-runner.ts';
import { installInboxDelivery } from './tavern/delivery-planner.ts';
import { seedDevelopmentChatDemos } from './tavern/development-chat-demos.ts';
import { installReminderScheduler } from './tavern/reminder-scheduler.ts';
import { startTavernRuntimeServer } from './tavern/server.ts';
import { recoverInterruptedAgentTurns } from './tavern/turn-recovery.ts';
import { seedDevelopmentWorkspaceDemos } from './workspace/development-demos.ts';
import { getAgentWorkspaceSource } from './workspace/instructions.ts';

let runtimeServer: ReturnType<typeof startTavernRuntimeServer> | null = null;
let runtimeJobs: RuntimeJobsManager | null = null;
let shuttingDown = false;

async function main(): Promise<void> {
    log.info('Grotto Runtime starting');

    // Homebrew/launchd services strip the user PATH; heal well-known CLI
    // homes so harness bridges and CLI spawns keep working under the service.
    for (const cli of ['codex', 'claude']) {
        ensureCliOnPath(cli);
    }

    const dbPath = path.join(DATA_DIR, 'runtime.db');
    const db = initDb(dbPath);
    ensureRuntimeSchema(db);
    ensureRuntimeJobsSchema(db);
    // The lazy seed during instruction prep can run before the DB exists and
    // skip source recording; without this the seeded skills read as external.
    for (const [skillId, content] of seededSkillDefaultEntries()) {
        recordSkillSource({
            db,
            installedHash: sha256(content),
            skillId,
            source: 'seeded',
        });
    }
    // Refresh managed skill files at startup so doctrine updates reach
    // existing installs before the first turn composes instructions.
    await seedManagedSkills().catch((err: unknown) => {
        log.warn('Seeded skills failed to refresh during startup', { err });
    });
    await runRuntimeDoctor({ db, reason: 'runtime_start' }).catch((err: unknown) => {
        log.warn('Runtime Doctor failed during startup', { err });
    });
    log.info('Runtime DB ready', { path: dbPath });
    const recovery = recoverInterruptedAgentTurns(db);
    if (recovery.recoveredTurnCount > 0) {
        log.info('Recovered interrupted agent turns', { count: recovery.recoveredTurnCount });
    }
    const demoSeed = await seedDevelopmentChatDemos({ db });
    if (demoSeed.seeded > 0) {
        log.info('Development chat demos ready', { count: demoSeed.seeded });
    }
    const demoWorkspaceSource = demoSeed.agentIds
        ? getAgentWorkspaceSource(db, demoSeed.agentIds.otto)
        : null;
    const workspaceDemoSeed = demoWorkspaceSource
        ? await seedDevelopmentWorkspaceDemos({ sources: [demoWorkspaceSource] })
        : { seeded: 0 };
    if (workspaceDemoSeed.seeded > 0) {
        log.info('Development workspace demos ready', {
            count: workspaceDemoSeed.seeded,
        });
    }
    runtimeJobs = await startRuntimeJobsManager();
    log.info('Runtime jobs ready');
    installInboxDelivery();
    log.info('Inbox delivery ready');
    installReminderScheduler();
    log.info('Reminder scheduler ready');

    // Browser supervision never blocks Runtime startup: launch or adoption
    // failures surface only through Browser capability health.
    setBrowserStatusListener(() => {
        void refreshRuntimeCapabilities({ ids: ['browser'], publishUpdated: true }).catch(
            (err: unknown) => {
                log.warn('Browser capability refresh failed', { err });
            }
        );
    });
    void reconcileBrowserService().catch((err: unknown) => {
        log.warn('Browser supervision failed to start', { err });
    });

    runtimeServer = startTavernRuntimeServer();
    setAgentCliServerUrl(runtimeServer.url);
    for (const agentId of recovery.agentIdsToWake) {
        wakeAgent(agentId);
    }
    log.info('Grotto Runtime running', { url: runtimeServer.url.toString() });

    await refreshRuntimeCapabilities({
        ids: ['gateway', 'apiServer', 'modelExecution', 'skills'],
        publishUpdated: true,
    }).catch((err: unknown) => {
        log.warn('Capability refresh failed after agent startup', {
            err,
        });
    });
}

async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
        log.warn('Shutdown already in progress; exiting', { signal });
        process.exit(signal === 'SIGINT' ? 130 : 143);
        return;
    }

    shuttingDown = true;
    log.info('Shutdown signal received', { signal });
    log.info('Stopping Runtime jobs');
    await runtimeJobs?.stop();
    log.info('Runtime jobs stopped');
    // Chrome stays running across Runtime restarts; only supervision stops.
    log.info('Stopping browser supervision');
    stopBrowserService();
    log.info('Browser supervision stopped');
    log.info('Closing MCP connections');
    await closeAllMcpClients();
    log.info('MCP connections closed');
    log.info('Stopping Runtime server');
    runtimeServer?.stop();
    log.info('Runtime server stopped');
    process.exit(0);
}

const result = await dispatch(process.argv.slice(2));

if (result.kind === 'serve') {
    process.on('SIGTERM', () => {
        void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
        void shutdown('SIGINT');
    });

    main().catch((err: unknown) => {
        log.fatal('Startup failed', { err });
        process.exit(1);
    });
} else {
    process.exit(result.code);
}
