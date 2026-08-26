import { env } from './config/env.ts';
import { readGrottoReleaseIdentity } from './grotto-release-identity.ts';
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
    logStartupBanner('🟠 Grotto Server', 'Booting the Grotto Server');
    const release = env.GROTTO_RELEASE_MANIFEST
        ? readGrottoReleaseIdentity(env.GROTTO_RELEASE_MANIFEST)
        : null;

    const application = await createGrottoServerApplication({
        appOrigin: env.GROTTO_APP_ORIGIN,
        attachmentRoot: env.GROTTO_ATTACHMENT_ROOT,
        clerkApiUrl: env.GROTTO_CLERK_API_URL,
        clerkIssuerUrl: env.GROTTO_CLERK_ISSUER_URL,
        clerkSecretKey: env.GROTTO_CLERK_SECRET_KEY,
        computerReleaseManifestUrl: env.GROTTO_COMPUTER_RELEASE_MANIFEST_URL,
        databaseUrl: env.GROTTO_DATABASE_URL,
        openAiApiKey: env.GROTTO_OPENAI_API_KEY,
        staticAppRoot: env.GROTTO_STATIC_APP_ROOT,
    });

    await application.listen(env.GROTTO_SERVER_PORT);

    registerShutdown(application);

    logStartupSection('Grotto Server');
    if (release) {
        logStartupDetail('🏷️', 'Product', release.productVersion);
        logStartupDetail('🧭', 'Revision', release.sourceRevision);
        logStartupDetail('🔒', 'Digest', release.contentDigest);
    }
    logStartupDetail('🐘', 'PostgreSQL', describeDatabaseUrl(env.GROTTO_DATABASE_URL));
    logStartupDetail('📎', 'Attachments', env.GROTTO_ATTACHMENT_ROOT);
    logStartupDetail('🔑', 'Clerk', env.GROTTO_CLERK_ISSUER_URL);
    logStartupDetail(
        '✉️',
        'Invitations',
        env.GROTTO_CLERK_SECRET_KEY
            ? 'verified-email lookup configured'
            : 'disabled — set GROTTO_CLERK_SECRET_KEY to accept invitations'
    );
    logStartupDetail('🌐', 'Grotto App origin', env.GROTTO_APP_ORIGIN);
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
