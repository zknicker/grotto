import type { AddressInfo } from 'node:net';
import { SQL } from 'bun';
import {
    createGrottoServerApplication,
    type GrottoServerApplication,
} from '../src/grotto-server-application.ts';
import type { ClerkUsers } from '../src/identity/clerk-users.ts';
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
    restart(): Promise<void>;
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

        const issuer = clerk;
        const sql = new SQL({ url: cluster.databaseUrl });
        let application: GrottoServerApplication | null = null;
        const harness: GrottoServerHarness = {
            appOrigin: harnessAppOrigin,
            clerk: issuer,
            clerkUsers,
            close: async () => {
                await sql.close();
                await application?.close();
                application = null;
                await issuer.close();
                await cluster.stop();
            },
            databaseUrl: cluster.databaseUrl,
            restart: async () => {
                await application?.close();
                application = null;
                await startApplication();
            },
            sql,
            url: new URL('http://127.0.0.1'),
        };

        const startApplication = async () => {
            const next = await createGrottoServerApplication({
                appOrigin: harnessAppOrigin,
                clerkIssuerUrl: issuer.url,
                clerkUsers,
                databaseUrl: cluster.databaseUrl,
            });
            await next.app.listen({ host: '127.0.0.1', port: 0 });
            application = next;
            const { port } = next.app.server.address() as AddressInfo;
            harness.url = new URL(`http://127.0.0.1:${port}`);
        };
        await startApplication();
        return harness;
    } catch (error) {
        await clerk?.close();
        await cluster.stop();
        throw error;
    }
}
