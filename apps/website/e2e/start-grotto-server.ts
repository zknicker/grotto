import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startClerkTestIssuer } from '../../server/test/clerk-test-issuer.ts';
import { startPostgresCluster } from '../../server/test/postgres-cluster.ts';
import { clerkSessionFile, e2eClerkUserId, e2ePeerClerkUserId } from './support/clerk-session.ts';

/**
 * Starts the hosted Grotto Server for e2e: a throwaway PostgreSQL cluster and a
 * local Clerk issuer, with the session token the browser will present written
 * where the specs read it. The pre-WS6 local sidecar is a separate process.
 */
const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const stateDirectory = fileURLToPath(new URL('../../../.context/e2e/', import.meta.url));
const clerkSessionPath = clerkSessionFile();
// The browser is the frontend that asks Clerk for the session, so it is the
// authorized party the Server binds to.
const appOrigin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3101';

mkdirSync(stateDirectory, { recursive: true });
rmSync(clerkSessionPath, { force: true });

const cluster = await startPostgresCluster();
const clerk = await startClerkTestIssuer(appOrigin);

// The invitation boundary asks Clerk which of a human's addresses are verified.
// The local issuer answers that too, so e2e drives the real acceptance path.
const e2eHumanEmail = 'e2e-human@grotto.test';
const e2ePeerEmail = 'e2e-peer@grotto.test';

clerk.setVerifiedEmails(e2eClerkUserId, [e2eHumanEmail]);
clerk.setVerifiedEmails(e2ePeerClerkUserId, [e2ePeerEmail]);

process.once('exit', () => {
    rmSync(clerkSessionPath, { force: true });
    void cluster.stop();
});
process.once('SIGTERM', () => {
    void shutdown();
});
process.once('SIGINT', () => {
    void shutdown();
});

writeFileSync(
    clerkSessionPath,
    JSON.stringify({
        databaseUrl: cluster.databaseUrl,
        peerEmail: e2ePeerEmail,
        peerToken: await clerk.mintSessionToken(e2ePeerClerkUserId),
        token: await clerk.mintSessionToken(e2eClerkUserId),
    })
);

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = appOrigin;
process.env.CLERK_API_URL = clerk.url;
process.env.CLERK_ISSUER_URL = clerk.url;
process.env.CLERK_SECRET_KEY = 'sk_test_grotto_e2e';
process.env.DATABASE_URL = cluster.databaseUrl;

process.chdir(workspaceRoot);

await import('../../server/src/grotto-server.ts');

let shuttingDown = false;

async function shutdown() {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    await clerk.close();
    await cluster.stop();
    rmSync(clerkSessionPath, { force: true });
    process.exit(0);
}
