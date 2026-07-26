import type { AddressInfo } from 'node:net';
import { SQL } from 'bun';
import { createGrottoServerApplication } from '../src/grotto-server-application.ts';
import { type ClerkTestIssuer, startClerkTestIssuer } from './clerk-test-issuer.ts';
import { type PostgresCluster, startPostgresCluster } from './postgres-cluster.ts';

/**
 * Boots the hosted Grotto Server against a throwaway PostgreSQL cluster and a
 * local Clerk issuer. Tests speak its public tRPC surface over HTTP, and read
 * committed rows straight from PostgreSQL through `sql`.
 */
export interface GrottoServerHarness {
    appOrigin: string;
    clerk: ClerkTestIssuer;
    close(): Promise<void>;
    databaseUrl: string;
    sql: SQL;
    url: URL;
}

export const harnessAppOrigin = 'https://app.grotto.test';

export async function startGrottoServerHarness(): Promise<GrottoServerHarness> {
    const cluster: PostgresCluster = await startPostgresCluster();
    let clerk: ClerkTestIssuer | null = null;

    try {
        clerk = await startClerkTestIssuer(harnessAppOrigin);

        const application = await createGrottoServerApplication({
            appOrigin: harnessAppOrigin,
            clerkIssuerUrl: clerk.url,
            databaseUrl: cluster.databaseUrl,
        });

        await application.app.listen({ host: '127.0.0.1', port: 0 });

        const { port } = application.app.server.address() as AddressInfo;
        const issuer = clerk;
        const sql = new SQL({ url: cluster.databaseUrl });

        return {
            appOrigin: harnessAppOrigin,
            clerk: issuer,
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
