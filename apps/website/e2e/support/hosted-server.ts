import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { appProtocolHeaders, appProtocolVersion } from '@tavern/api/app-protocol';
import { createTRPCClient, httpLink } from '@trpc/client';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { readClerkSessionFixture, signInAsClerkHuman } from './clerk-session.ts';

export async function createHostedTestServer(
    page: Page,
    input: { displayName: string; slug: string }
) {
    await signInAsClerkHuman(page);
    const session = readClerkSessionFixture();
    const client = createHostedClient(session.token);
    await client.server.create.mutate(input);
    const server = await client.server.bySlug.query({ slug: input.slug });
    await page.goto(`/s/${input.slug}`);

    return { client, server, session };
}

export async function openHostedChannel(page: Page, name: string) {
    await page.getByRole('row', { exact: true, name }).click();
}

export async function openHostedSection(page: Page, name: string) {
    await page.getByRole('row', { exact: true, name }).click();
}

export function createHostedClient(token: string) {
    return createTRPCClient<GrottoRouter>({
        links: [
            httpLink({
                headers: {
                    authorization: `Bearer ${token}`,
                    [appProtocolHeaders.productVersion]: 'e2e',
                    [appProtocolHeaders.protocolVersion]: String(appProtocolVersion),
                },
                url: `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/trpc`,
            }),
        ],
    });
}

export function runHostedPsql(databaseUrl: string, statement: string) {
    return execFileSync(resolvePsql(), [
        databaseUrl,
        '--no-psqlrc',
        '--tuples-only',
        '--no-align',
        '--field-separator=|',
        '--command',
        statement,
    ])
        .toString()
        .trim();
}

export function assertOpaqueId(value: string | undefined): asserts value is string {
    if (!(value && /^[a-z0-9_-]+$/iu.test(value))) {
        throw new Error('The hosted messaging fixture did not resolve an opaque id.');
    }
}

function resolvePsql() {
    const roots = [
        process.env.GROTTO_POSTGRES_BIN,
        '/opt/homebrew/opt/postgresql@16/bin',
        '/opt/homebrew/opt/libpq/bin',
        '/usr/local/opt/postgresql@16/bin',
        '',
    ].filter((root): root is string => root !== undefined);

    return roots.map((root) => join(root, 'psql')).find(existsSync) ?? 'psql';
}
