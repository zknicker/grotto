import type { AddressInfo } from 'node:net';
import { SQL } from 'bun';
import { createGrottoServerApplication } from '../src/grotto-server-application.ts';
import type { ClerkUsers } from '../src/identity/clerk-users.ts';
import { bootstrapGrottoDatabase } from '../src/postgres/bootstrap.ts';
import { type ClerkTestIssuer, startClerkTestIssuer } from './clerk-test-issuer.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

/**
 * Clerk's verified-email lookup is a real network boundary, so it is the one
 * thing these tests stand in for. Everything else — PostgreSQL, transactions,
 * token verification — is real.
 */
export interface ClerkVerifiedEmails extends ClerkUsers {
    setVerifiedEmails(clerkUserId: string, emails: string[]): void;
}

function createClerkVerifiedEmails(): ClerkVerifiedEmails {
    const byClerkUserId = new Map<string, string[]>();

    return {
        readVerifiedEmails: (clerkUserId) => Promise.resolve(byClerkUserId.get(clerkUserId) ?? []),
        setVerifiedEmails: (clerkUserId, emails) => {
            byClerkUserId.set(clerkUserId, emails);
        },
    };
}

/**
 * Boots the hosted Grotto Server against a throwaway PostgreSQL cluster and a
 * local Clerk issuer. Tests speak its public tRPC surface over HTTP, and read
 * committed rows straight from PostgreSQL through `sql`.
 */
export interface GrottoServerHarness {
    appOrigin: string;
    clerk: ClerkTestIssuer;
    clerkUsers: ClerkVerifiedEmails;
    close(): Promise<void>;
    databaseUrl: string;
    sql: SQL;
    url: URL;
}

export const harnessAppOrigin = 'https://app.grotto.test';

export async function startGrottoServerHarness(): Promise<GrottoServerHarness> {
    const cluster: PostgresCluster = await startPostgresCluster();
    const clerkUsers = createClerkVerifiedEmails();
    let clerk: ClerkTestIssuer | null = null;

    try {
        clerk = await startClerkTestIssuer(harnessAppOrigin);
        await bootstrapGrottoDatabase(cluster.databaseUrl, 'grotto');

        const application = await createGrottoServerApplication({
            appOrigin: harnessAppOrigin,
            clerkIssuerUrl: clerk.url,
            clerkUsers,
            databaseUrl: cluster.databaseUrl,
        });

        await application.app.listen({ host: '127.0.0.1', port: 0 });

        const { port } = application.app.server.address() as AddressInfo;
        const issuer = clerk;
        const sql = new SQL({ url: cluster.databaseUrl });

        return {
            appOrigin: harnessAppOrigin,
            clerk: issuer,
            clerkUsers,
            close: async () => {
                await sql.close();
                await application.close();
                await issuer.close();
                await cluster.stop();
            },
            databaseUrl: cluster.databaseUrl,
            sql,
            url: new URL(`http://127.0.0.1:${port}`),
        };
    } catch (error) {
        await clerk?.close();
        await cluster.stop();
        throw error;
    }
}
