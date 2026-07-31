import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { appProtocolHeaders, appProtocolVersion } from '@tavern/api/app-protocol';
import { createTRPCClient, httpLink } from '@trpc/client';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { clerkSessionFile, e2eClerkUserId, signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

test('hosted task board survives reconnect and loses tasks with parent Chat access', async ({
    page,
}) => {
    await signInAsClerkHuman(page);
    await page.goto('/s');
    await page.getByLabel('Name').fill('Hosted Tasks');
    await page.getByLabel('Address').fill('hosted-tasks');
    await page.getByRole('button', { name: 'Create Server' }).click();
    await page.getByRole('button', { name: 'Tasks' }).click();

    await page.getByRole('button', { name: 'New task' }).click();
    await page.getByPlaceholder('What needs to be done?').fill('Prove the hosted task flow');
    await page.getByRole('button', { name: 'Create task' }).click();

    let card = taskCard(page);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Claim' }).click();
    await expect(card.getByRole('button', { name: 'Unclaim' })).toBeVisible();

    const status = card.getByRole('combobox', { name: 'Status for task #1' });
    await status.click();
    await page.getByRole('option', { name: 'In progress' }).click();
    card = taskCard(page);
    await expect(card.getByRole('combobox', { name: 'Status for task #1' })).toHaveText(
        'In progress'
    );
    await card.getByRole('button', { name: 'Unclaim' }).click();
    await expect(card.getByRole('button', { name: 'Claim' })).toBeVisible();

    await page.getByRole('button', { name: 'Task labels' }).click();
    await page.getByLabel('New task label').fill('backend');
    await page.getByRole('button', { name: 'Add label' }).click();
    const renameLabel = page.getByLabel('Rename backend');
    await renameLabel.fill('review');
    await renameLabel.press('Enter');
    await expect(page.getByLabel('Rename review')).toBeVisible();
    const labelRow = page.getByLabel('Rename review').locator('xpath=ancestor::li');
    await labelRow.getByRole('button', { name: /^Color:/u }).click();
    await page.getByRole('button', { name: 'Purple' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    card = taskCard(page);
    const priority = card.getByRole('combobox', { name: 'Priority for task #1' });
    await priority.click();
    await page.getByRole('option', { name: 'Urgent' }).click();
    await expect(taskCard(page).getByRole('combobox', { name: 'Priority for task #1' })).toHaveText(
        'Urgent'
    );
    await taskCard(page).getByRole('button', { name: 'Labels for task #1' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'review' }).click();
    await expect(taskCard(page).getByText('review', { exact: true })).toBeVisible();

    const { databaseUrl, peerToken, token } = JSON.parse(
        readFileSync(clerkSessionFile(), 'utf8')
    ) as {
        databaseUrl: string;
        peerToken: string;
        token: string;
    };
    const client = createHostedClient(token);
    const peer = createHostedClient(peerToken);
    await peer.server.create.mutate({
        displayName: 'Hosted Task Peer Root',
        slug: 'hosted-task-peer-root',
    });
    const server = await client.server.bySlug.query({ slug: 'hosted-tasks' });
    const allChatId = server.channels.find((chat) => chat.name === 'all')?.id;
    const peerUserId = runPsql(
        databaseUrl,
        "select id from users where clerk_user_id = 'user_e2e_peer'"
    );
    if (!allChatId) {
        throw new Error('The hosted task flow did not resolve #all.');
    }
    runPsql(
        databaseUrl,
        `insert into server_memberships (id, server_id, user_id, role)
         values ('mem_hosted_task_peer', '${server.id}', '${peerUserId}', 'member');
         insert into channel_participants (server_id, chat_id, user_id)
         values ('${server.id}', '${allChatId}', '${peerUserId}')`
    );
    await page.reload();
    await page.getByRole('button', { name: 'Tasks' }).click();
    card = taskCard(page);
    const assignee = card.getByRole('combobox', { name: 'Assignee for task #1' });
    await assignee.click();
    await page
        .getByRole('option', { name: new RegExp(`${peerUserId.slice(-6)} · member$`, 'u') })
        .click();
    await expect(
        taskCard(page).getByRole('combobox', { name: 'Assignee for task #1' })
    ).toContainText(peerUserId.slice(-6));

    const snapshot = await client.task.list.query({ serverId: server.id });
    const task = snapshot[0]?.task;
    if (!task) {
        throw new Error('The hosted task flow did not resolve its task.');
    }

    await page.context().setOffline(true);
    await client.task.assign.mutate({
        assigneeUserId: null,
        expectedVersion: task.version,
        messageId: task.messageId,
        serverId: server.id,
    });
    await page.context().setOffline(false);
    await expect(taskCard(page).getByRole('combobox', { name: 'Assignee for task #1' })).toHaveText(
        'Unassigned'
    );

    const userId = runPsql(
        databaseUrl,
        `select id from users where clerk_user_id = '${e2eClerkUserId}'`
    );
    runPsql(
        databaseUrl,
        `delete from channel_participants
         where server_id = '${server.id}' and user_id = '${userId}'`
    );
    await page.reload();
    await page.getByRole('button', { name: 'Tasks' }).click();
    await expect(page.getByText('No tasks yet')).toBeVisible();
    await expect(page.getByText('Prove the hosted task flow', { exact: true })).toHaveCount(0);
});

test('a hosted task message projects its status in the Chat and opens its Thread', async ({
    page,
}) => {
    await signInAsClerkHuman(page);
    await page.goto('/s');
    await page.getByLabel('Name').fill('Task Projection');
    await page.getByLabel('Address').fill('task-projection');
    await page.getByRole('button', { name: 'Create Server' }).click();
    await page.getByRole('button', { name: 'all', exact: true }).click();

    await page.getByRole('textbox', { name: 'Message all' }).fill('Projected task message');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Projected task message', { exact: true })).toBeVisible();

    const { token } = JSON.parse(readFileSync(clerkSessionFile(), 'utf8')) as { token: string };
    const client = createHostedClient(token);
    const server = await client.server.bySlug.query({ slug: 'task-projection' });
    const allChatId = server.channels.find((chat) => chat.name === 'all')?.id;
    if (!allChatId) {
        throw new Error('The task projection flow did not resolve #all.');
    }
    const snapshot = await client.chat.messages.query({ chatId: allChatId, serverId: server.id });
    const anchor = snapshot.messages.find(
        (message) => message.content === 'Projected task message'
    );
    if (!anchor) {
        throw new Error('The task projection flow did not resolve its anchor message.');
    }

    const promotion = await client.task.promote.mutate({
        messageId: anchor.id,
        serverId: server.id,
    });

    const row = page
        .getByText('Projected task message', { exact: true })
        .locator('xpath=ancestor::div[@data-message-id][1]');
    await expect(row.getByTestId('message-task-badge')).toBeVisible();
    await expect(row.getByRole('button', { name: /Todo\. Open thread$/u })).toBeVisible();

    // Claiming advances status through the same task realtime invalidation; no reload.
    const claim = await client.task.claim.mutate({
        expectedVersion: promotion.task.version,
        messageId: anchor.id,
        serverId: server.id,
    });
    const ownerSuffix = claim.task.assigneeUserId?.slice(-6);
    if (!ownerSuffix) {
        throw new Error('The task projection flow did not resolve the claiming human.');
    }
    await expect(row.getByRole('button', { name: /In progress.*Open thread$/u })).toBeVisible();
    await expect(row.getByTestId('message-task-badge')).toContainText(`Human ${ownerSuffix}`);

    await row.getByRole('button', { name: /Open thread$/u }).click();
    await expect(page.getByRole('complementary', { name: 'Thread' })).toBeVisible();
});

function taskCard(page: Page) {
    return page
        .getByText('Prove the hosted task flow', { exact: true })
        .locator('xpath=ancestor::article');
}

function createHostedClient(token: string) {
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

function runPsql(databaseUrl: string, statement: string) {
    return execFileSync(resolvePsql(), [
        databaseUrl,
        '--no-psqlrc',
        '--tuples-only',
        '--no-align',
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
