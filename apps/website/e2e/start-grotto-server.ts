import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startClerkTestIssuer } from '../../server/test/clerk-test-issuer.ts';
import { startPostgresCluster } from '../../server/test/postgres-cluster.ts';
import { clerkSessionFile, e2eClerkUserId } from './support/clerk-session.ts';

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

process.once('exit', () => cluster.stop());
process.once('SIGTERM', () => process.exit(0));
process.once('SIGINT', () => process.exit(0));

writeFileSync(
    clerkSessionPath,
    JSON.stringify({ token: await clerk.mintSessionToken(e2eClerkUserId) })
);

process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = appOrigin;
process.env.CLERK_ISSUER_URL = clerk.url;
process.env.DATABASE_URL = cluster.databaseUrl;

process.chdir(workspaceRoot);

await import('../../server/src/grotto-server.ts');
