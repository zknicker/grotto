import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTRPCClient, httpLink } from '@trpc/client';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { clerkSessionFile, signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

test('a human messages in #all with only the hosted Server online', async ({ page }) => {
    const localProductRequests: string[] = [];
    const localServerOrigin = `http://127.0.0.1:${process.env.TAVERN_SERVER_PORT}`;
    const runtimeOrigin = `http://127.0.0.1:${process.env.TAVERN_RUNTIME_PORT}`;

    page.on('request', (request) => {
        if (
            request.url().startsWith(localServerOrigin) ||
            request.url().startsWith(runtimeOrigin)
        ) {
            localProductRequests.push(request.url());
        }
    });

    await expect(fetch(`${localServerOrigin}/healthz`)).rejects.toThrow();
    await expect(fetch(`${runtimeOrigin}/capabilities`)).rejects.toThrow();
    await signInAsClerkHuman(page);
    await page.goto('/s');
    await page.getByLabel('Name').fill('Hosted Messages');
    await page.getByLabel('Address').fill('hosted-messages');
    await page.getByRole('button', { name: 'Create Server' }).click();

    const composer = page.getByPlaceholder('Message #all');
    await composer.fill('First durable human message');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('First durable human message')).toBeVisible();
    await expect(page.getByTestId('read-state')).toContainText('Read through 1');

    await page.reload();
    await expect(page.getByText('First durable human message')).toBeVisible();
    await composer.fill('Second durable human message');
    await page.getByRole('button', { name: 'Send' }).click();

    const messages = page.locator('[data-hosted-message-sequence]');
    await expect(messages).toHaveCount(2);
    await expect(messages.nth(0)).toHaveAttribute('data-hosted-message-sequence', '1');
    await expect(messages.nth(1)).toHaveAttribute('data-hosted-message-sequence', '2');

    await page.getByPlaceholder('Search messages').fill('First durable');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('button', { name: /First durable human message/u })).toBeVisible();

    const { databaseUrl, peerToken, token } = JSON.parse(
        readFileSync(clerkSessionFile(), 'utf8')
    ) as {
        databaseUrl: string;
        peerToken: string;
        token: string;
    };
    const owner = createHostedClient(token);
    const peer = createHostedClient(peerToken);
    await peer.server.create.mutate({
        displayName: 'Hosted Peer Root',
        slug: 'hosted-peer-root',
    });
    const openedServer = await owner.server.bySlug.query({ slug: 'hosted-messages' });
    const serverId = openedServer.id;
    const allChatId = openedServer.channels.find((channel) => channel.name === 'all')?.id;
    const peerUserId = runPsql(
        databaseUrl,
        "select id from users where clerk_user_id = 'user_e2e_peer'"
    );
    assertOpaqueId(serverId);
    assertOpaqueId(allChatId);
    assertOpaqueId(peerUserId);
    runPsql(
        databaseUrl,
        `insert into server_memberships (id, server_id, user_id, role)
         values ('mem_e2e_peer', '${serverId}', '${peerUserId}', 'member');
         insert into channel_participants (server_id, chat_id, user_id)
         values ('${serverId}', '${allChatId}', '${peerUserId}')`
    );
    await peer.chat.send.mutate({
        chatId: allChatId,
        content: 'Peer-authored hosted message',
        nonce: 'e2e-peer-message',
        serverId,
    });

    const peerAuthor = page.getByRole('button', {
        name: `Human ${peerUserId.slice(-6)}`,
    });
    await expect(peerAuthor).toBeVisible();
    await composer.fill('Draft belongs only to #all');
    await peerAuthor.click();
    const dmComposer = page.getByPlaceholder(/Message Direct/u);
    await expect(dmComposer).toBeVisible();
    await expect(dmComposer).toHaveValue('');
    await page.getByRole('button', { name: '#all' }).click();
    await expect(composer).toHaveValue('');

    expect(localProductRequests).toEqual([]);
});

function createHostedClient(token: string) {
    return createTRPCClient<GrottoRouter>({
        links: [
            httpLink({
                headers: { authorization: `Bearer ${token}` },
                url: `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/trpc`,
            }),
        ],
    });
}

function runPsql(databaseUrl: string, statement: string) {
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

function assertOpaqueId(value: string | undefined): asserts value is string {
    if (!(value && /^[a-z0-9_-]+$/iu.test(value))) {
        throw new Error('The hosted messaging fixture did not resolve an opaque id.');
    }
}

test('a signed-out human cannot read hosted messages', async ({ page }) => {
    await page.goto('/s/hosted-messages');

    await expect(page.getByText('Server unavailable')).toBeVisible();
    await expect(page.getByText('First durable human message')).toHaveCount(0);
});

test('an ordinary local route retains its local Runtime boundary', async ({ page }) => {
    const localServerOrigin = `http://127.0.0.1:${process.env.TAVERN_SERVER_PORT}`;
    const localRequest = page.waitForRequest((request) =>
        request.url().startsWith(`${localServerOrigin}/trpc/`)
    );

    await page.goto('/activity');
    await expect(localRequest).resolves.toBeDefined();
});
