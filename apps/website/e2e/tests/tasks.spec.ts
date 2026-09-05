import type { Page } from '@playwright/test';
import { e2eClerkUserId } from '../support/clerk-session.ts';
import { createClient, createTestServer, openChannel, runPsql } from '../support/server.ts';
import { expect, test } from '../support/test.ts';

test('hosted task board survives reconnect and loses tasks with parent Chat access', async ({
    page,
}) => {
    const { client, server, session } = await createTestServer(page, {
        displayName: 'Hosted Tasks',
        slug: 'tasks',
    });
    await page.goto('/s/tasks/tasks');

    await page.getByRole('button', { name: 'New task' }).click();
    // Pin the anchor Chat: the dialog defaults to the most recently active
    // chat, which on a fresh Server is Cove's onboarding channel once its
    // first message lands — a race this test must not depend on.
    await page.getByRole('button', { name: /Chat/u }).click();
    await page.getByRole('option', { name: '#all' }).click();
    await page.getByPlaceholder('What needs to be done?').fill('Prove the hosted task flow');
    await page.getByRole('button', { name: 'Create task' }).click();

    // The default lens is the Linear-style list, and opening a row shows the
    // task Thread in a dialog over the tasks page rather than navigating.
    await page.getByRole('button', { name: /Open task #1 Prove the hosted task flow/u }).click();
    const dialog = page.getByRole('dialog', { name: 'Task #1 thread' });
    await expect(dialog.getByRole('region', { name: 'Task #1 details' })).toBeVisible();
    await expect(dialog.getByText('Prove the hosted task flow', { exact: true })).toBeVisible();
    const threadViewport = dialog.locator('.overflow-y-auto');
    await expect
        .poll(() => threadViewport.evaluate((element) => element.scrollWidth - element.clientWidth))
        .toBeLessThanOrEqual(0);
    await dialog.getByRole('button', { name: 'Close thread' }).click();
    await expect(dialog).toHaveCount(0);

    // Inline metadata controls live on the board cards, so switch lenses for
    // the control flow below. The lens lives in the topbar's display menu.
    await selectTaskLens(page, 'Board');

    let card = taskCard(page);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Claim' }).click();
    await expect(card.getByRole('button', { name: 'Unclaim' })).toBeVisible();

    const status = taskControl(card, 'Status');
    await status.click();
    await page.getByRole('option', { name: 'In progress' }).click();
    card = taskCard(page);
    await expect(taskControl(card, 'Status')).toContainText('In progress');
    await card.getByRole('button', { name: 'Unclaim' }).click();
    await expect(card.getByRole('button', { name: 'Claim' })).toBeVisible();

    await page.getByRole('button', { name: 'Manage Labels' }).click();
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
    const priority = taskControl(card, 'Priority');
    await priority.click();
    await page.getByRole('option', { name: 'Urgent' }).click();
    await expect(taskControl(taskCard(page), 'Priority')).toContainText('Urgent');
    await taskCard(page).getByRole('button', { name: 'Labels for task #1' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'review' }).click();
    await expect(taskCard(page).getByText('review', { exact: true })).toBeVisible();

    const peer = createClient(session.peerToken);
    await peer.server.create.mutate({
        displayName: 'Hosted Task Peer Root',
        slug: 'task-peer-root',
    });
    const allChatId = server.channels.find((chat) => chat.name === 'all')?.id;
    const peerUserId = runPsql(
        session.databaseUrl,
        "select id from users where clerk_user_id = 'user_e2e_peer'"
    );
    if (!allChatId) {
        throw new Error('The hosted task flow did not resolve #all.');
    }
    runPsql(
        session.databaseUrl,
        `insert into server_memberships (id, server_id, user_id, role)
         values ('mem_hosted_task_peer', '${server.id}', '${peerUserId}', 'member');
         insert into channel_participants (server_id, chat_id, user_id)
         values ('${server.id}', '${allChatId}', '${peerUserId}')`
    );
    await page.reload();
    card = taskCard(page);
    const assignee = taskControl(card, 'Assignee');
    await assignee.click();
    await page
        // Name and role stack in the option now, so they are separate text
        // nodes rather than the old `name · role` single line.
        .getByRole('option', { name: new RegExp(`${peerUserId.slice(-6)}\\s*member$`, 'u') })
        .click();
    await expect(taskControl(taskCard(page), 'Assignee')).toContainText(peerUserId.slice(-6));

    const snapshot = await client.task.list.query({ serverId: server.id });
    const task = snapshot[0]?.task;
    if (!task) {
        throw new Error('The hosted task flow did not resolve its task.');
    }

    await page.context().setOffline(true);
    await client.task.assign.mutate({
        assignee: null,
        expectedVersion: task.version,
        messageId: task.messageId,
        serverId: server.id,
    });
    await page.context().setOffline(false);
    await expect(taskControl(taskCard(page), 'Assignee')).toContainText('Unassigned');

    const userId = runPsql(
        session.databaseUrl,
        `select id from users where clerk_user_id = '${e2eClerkUserId}'`
    );
    runPsql(
        session.databaseUrl,
        `delete from channel_participants
         where server_id = '${server.id}' and user_id = '${userId}'`
    );
    await page.reload();
    await expect(page.getByText('No tasks yet')).toBeVisible();
    await expect(page.getByText('Prove the hosted task flow', { exact: true })).toHaveCount(0);
});

test('a hosted task message projects its status in the Chat and opens its Thread', async ({
    page,
}) => {
    const { client, server } = await createTestServer(page, {
        displayName: 'Task Projection',
        slug: 'task-projection',
    });
    await openChannel(page, 'all');

    await page.getByRole('textbox', { name: 'Message all' }).fill('Projected task message');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Projected task message', { exact: true })).toBeVisible();

    const allChatId = server.channels.find((chat) => chat.name === 'all')?.id;
    if (!allChatId) {
        throw new Error('The task projection flow did not resolve #all.');
    }
    // The visible row above may still be the optimistic one, so wait for the
    // Server to own the message before promoting it.
    await expect
        .poll(async () => {
            const snapshot = await client.chat.messages.query({
                chatId: allChatId,
                serverId: server.id,
            });
            return snapshot.messages.some(
                (message) => message.content === 'Projected task message'
            );
        })
        .toBe(true);
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
    await expect(row.getByRole('button', { exact: true, name: 'Open thread' })).toBeVisible();

    // Claiming advances status through the same task realtime invalidation; no reload.
    const claim = await client.task.claim.mutate({
        expectedVersion: promotion.task.version,
        messageId: anchor.id,
        serverId: server.id,
    });
    if (!claim.task.assigneeUserId) {
        throw new Error('The task projection flow did not resolve the claiming human.');
    }
    const directory = await client.member.list.query({ serverId: server.id });
    const assignee = directory.members.find(
        (member) => member.userId === claim.task.assigneeUserId
    );
    if (!assignee?.displayName) {
        throw new Error('The claiming human did not carry a canonical display name.');
    }
    await expect(row.getByTestId('message-task-badge')).toContainText(assignee.displayName);

    await row.getByRole('button', { exact: true, name: 'Open thread' }).click();
    const thread = page.getByRole('complementary', { name: 'Thread' });
    await expect(thread).toBeVisible();
    await expect(thread.getByRole('region', { name: 'Task #1 details' })).toBeVisible();
    await expect(thread.getByRole('button', { name: 'Status for task #1' })).toContainText(
        'In progress'
    );
});

function taskCard(page: Page) {
    return page.getByRole('row', { exact: true, name: 'Prove the hosted task flow' });
}

function taskControl(card: ReturnType<typeof taskCard>, name: 'Assignee' | 'Priority' | 'Status') {
    return card.getByRole('button', { name: new RegExp(`${name} for task #1$`, 'u') });
}

/** The list/board lens lives behind the topbar's display-options menu. */
async function selectTaskLens(page: Page, lens: 'Board' | 'List') {
    await page.getByRole('button', { name: 'Display options' }).click();
    await page.getByLabel('Task layout').getByText(lens).click();
    await page.keyboard.press('Escape');
}
