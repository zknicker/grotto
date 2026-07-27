import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    attachmentRoot: string;
    clerk: ClerkTestIssuer;
    close(): Promise<void>;
    databaseUrl: string;
    sql: SQL;
    url: URL;
}

export const harnessAppOrigin = 'https://app.grotto.test';

export async function startGrottoServerHarness(): Promise<GrottoServerHarness> {
    const cluster: PostgresCluster = await startPostgresCluster();
    const attachmentRoot = await mkdtemp(join(tmpdir(), 'grotto-server-attachments-'));
    let clerk: ClerkTestIssuer | null = null;

    try {
        clerk = await startClerkTestIssuer(harnessAppOrigin);

        const application = await createGrottoServerApplication({
            appOrigin: harnessAppOrigin,
            attachmentRoot,
            clerkIssuerUrl: clerk.url,
            databaseUrl: cluster.databaseUrl,
        });

        await application.app.listen({ host: '127.0.0.1', port: 0 });

        const { port } = application.app.server.address() as AddressInfo;
        const issuer = clerk;
        const sql = new SQL({ url: cluster.databaseUrl });

        return {
            appOrigin: harnessAppOrigin,
            attachmentRoot,
            clerk: issuer,
            close: async () => {
                await sql.close();
                await application.close();
                await issuer.close();
                await cluster.stop();
                await rm(attachmentRoot, { force: true, recursive: true });
            },
            databaseUrl: cluster.databaseUrl,
            sql,
            url: new URL(`http://127.0.0.1:${port}`),
        };
    } catch (error) {
        await clerk?.close();
        await cluster.stop();
        await rm(attachmentRoot, { force: true, recursive: true });
        throw error;
    }
}
