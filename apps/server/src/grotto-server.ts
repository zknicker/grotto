import { env } from './config/env.ts';
import {
    createGrottoServerApplication,
    type GrottoServerApplication,
} from './grotto-server-application.ts';
import { describeDatabaseUrl } from './postgres/database-url.ts';
import {
    logStartupBanner,
    logStartupComplete,
    logStartupDetail,
    logStartupFailure,
    logStartupSection,
} from './startup-log.ts';

async function start() {
    logStartupBanner('🟠 Grotto Server', 'Booting the hosted Grotto Server');

    const application = await createGrottoServerApplication({
        appOrigin: env.APP_ORIGIN,
        clerkIssuerUrl: env.CLERK_ISSUER_URL,
        databaseUrl: env.GROTTO_DATABASE_URL,
        staticAppRoot: env.GROTTO_STATIC_APP_ROOT,
    });

    await application.listen(env.GROTTO_SERVER_PORT);

    registerShutdown(application);

    logStartupSection('Grotto Server');
    logStartupDetail('🐘', 'PostgreSQL', describeDatabaseUrl(env.GROTTO_DATABASE_URL));
    logStartupDetail('🔑', 'Clerk', env.CLERK_ISSUER_URL);
    logStartupDetail('🌐', 'App origin', env.APP_ORIGIN);
    logStartupDetail('📡', 'HTTP', `http://127.0.0.1:${env.GROTTO_SERVER_PORT}`);
    logStartupDetail('🔌', 'WebSocket', `ws://127.0.0.1:${env.GROTTO_SERVER_PORT}/trpc`);
    logStartupComplete('Grotto Server is ready');
}

function registerShutdown(application: GrottoServerApplication) {
    process.once('SIGTERM', () => {
        void application.close().catch((error) => {
            console.error('[grotto] failed to close the Grotto Server', error);
        });
    });
}

start().catch((error) => {
    logStartupFailure('Grotto Server boot failed');
    console.error(error);
    process.exitCode = 1;
});
