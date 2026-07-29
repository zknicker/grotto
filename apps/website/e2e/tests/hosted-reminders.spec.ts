import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appProtocolHeaders, appProtocolVersion } from '@tavern/api/app-protocol';
import { createTRPCClient, httpLink } from '@trpc/client';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { clerkSessionFile, signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

test('hosted reminder operator state cancels and catches up after reconnect', async ({ page }) => {
    await signInAsClerkHuman(page);
    await page.goto('/s');
    await page.getByLabel('Name').fill('Hosted Reminders');
    await page.getByLabel('Address').fill('hosted-reminders');
    await page.getByRole('button', { name: 'Create Server' }).click();
    await page.getByRole('button', { name: 'all', exact: true }).click();
    await page.getByRole('textbox', { name: 'Message all' }).fill('Reminder anchor');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Reminder anchor', { exact: true })).toBeVisible();

    const session = JSON.parse(readFileSync(clerkSessionFile(), 'utf8')) as {
        databaseUrl: string;
        token: string;
    };
    const owner = createHostedClient(session.token);
    const server = await owner.server.bySlug.query({ slug: 'hosted-reminders' });
    const chatId = server.channels.find((channel) => channel.name === 'all')?.id;
    if (!chatId) {
        throw new Error('The hosted reminder fixture did not resolve #all.');
    }
    const messages = await owner.chat.messages.query({
        chatId,
        serverId: server.id,
    });
    const anchorMessageId = messages.messages.find(
        (message) => message.content === 'Reminder anchor'
    )?.id;
    if (!anchorMessageId) {
        throw new Error('The hosted reminder fixture did not resolve its anchor.');
    }
    const canaryPath = `/tmp/tavern-hosted-reminder-${crypto.randomUUID()}`;
    seedReminderState({
        anchorMessageId,
        canaryPath,
        chatId,
        databaseUrl: session.databaseUrl,
        serverId: server.id,
    });

    await page.goto('/s/hosted-reminders/reminders');
    const watchdog = page.getByText('Local watchdog', { exact: true }).locator('xpath=../../..');
    await expect(watchdog).toContainText('Script ·');
    await expect(watchdog).toContainText('local execution only');
    expect(existsSync(canaryPath)).toBe(false);

    await watchdog.getByRole('button', { name: 'Fire log' }).click();
    await expect(page.getByText('Scheduled Jul 26, 9:00 AM')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await watchdog.getByRole('button', { name: 'Cancel reminder' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Cancel reminder?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel reminder' }).click();
    await expect(watchdog).toContainText('canceled');
    expect(existsSync(canaryPath)).toBe(false);

    await page.context().setOffline(true);
    await owner.reminder.cancel.mutate({
        commandId: 'e2e-offline-cancel',
        expectedVersion: 1,
        reminderId: 'rem_e2e_offline',
        serverId: server.id,
    });
    await page.context().setOffline(false);
    const offlineReminder = page
        .getByText('Offline follow-up', { exact: true })
        .locator('xpath=../../..');
    await expect(offlineReminder).toContainText('canceled');
    await expect(offlineReminder.getByRole('button', { name: 'Cancel reminder' })).toHaveCount(0);

    runPsql(
        session.databaseUrl,
        `update server_memberships set role = 'member'
         where server_id = '${server.id}'
           and user_id = (
             select id from users where clerk_user_id = 'user_e2e_human'
           )`
    );
    await page.reload();
    await expect(page.getByText('Owner or Admin required')).toBeVisible();
    await expect(page.getByText('Local watchdog')).toHaveCount(0);
    expect(existsSync(canaryPath)).toBe(false);
});

function seedReminderState(input: {
    anchorMessageId: string;
    canaryPath: string;
    chatId: string;
    databaseUrl: string;
    serverId: string;
}) {
    runPsql(
        input.databaseUrl,
        `begin;
         insert into agents (
           id, server_id, handle, display_name, character, home_timezone, role
         ) values (
           'agt_e2e_reminder', '${input.serverId}', 'Cove', 'Cove', 'blob',
           'America/New_York', 'member'
         );
         insert into channel_agent_participants (server_id, chat_id, agent_id)
         values ('${input.serverId}', '${input.chatId}', 'agt_e2e_reminder');
         insert into chat_messages (
           id, server_id, chat_id, sequence, system_author, content, nonce, created_at
         ) values (
           'msg_e2e_fire_receipt', '${input.serverId}', '${input.chatId}', 2,
           'reminder', '🔔 Reminder: Local watchdog', 'e2e-reminder-fire',
           '2026-07-26T13:00:00.000Z'
         );
         update chats set last_message_sequence = 2
         where server_id = '${input.serverId}' and id = '${input.chatId}';
         insert into reminders (
           id, server_id, owner_agent_id, title, anchor_chat_id, anchor_message_id,
           fire_at, repeat, timezone, script, status, version, created_at, updated_at
         ) values
         (
           'rem_e2e_watchdog', '${input.serverId}', 'agt_e2e_reminder',
           'Local watchdog', '${input.chatId}', '${input.anchorMessageId}',
           '2099-07-27T13:00:00.000Z', 'daily@09:00', 'America/New_York',
           'touch ${input.canaryPath}', 'scheduled', 1,
           '2026-07-26T12:00:00.000Z', '2026-07-26T13:00:00.000Z'
         ),
         (
           'rem_e2e_offline', '${input.serverId}', 'agt_e2e_reminder',
           'Offline follow-up', '${input.chatId}', '${input.anchorMessageId}',
           '2099-07-28T13:00:00.000Z', null, 'America/New_York',
           null, 'scheduled', 1,
           '2026-07-26T12:00:00.000Z', '2026-07-26T12:00:00.000Z'
         );
         insert into reminder_fires (
           id, server_id, reminder_id, scheduled_for, fired_at, receipt_message_id
         ) values (
           'rmf_e2e_watchdog', '${input.serverId}', 'rem_e2e_watchdog',
           '2026-07-26T13:00:00.000Z', '2026-07-26T13:00:00.000Z',
           'msg_e2e_fire_receipt'
         );
         insert into reminder_agent_attention (
           id, server_id, agent_id, reminder_id, fire_id, anchor_chat_id,
           receipt_message_id, attention_kind, script, queued_at
         ) values (
           'rma_e2e_watchdog', '${input.serverId}', 'agt_e2e_reminder',
           'rem_e2e_watchdog', 'rmf_e2e_watchdog', '${input.chatId}',
           'msg_e2e_fire_receipt', 'reminder_script',
           'touch ${input.canaryPath}', '2026-07-26T13:00:00.000Z'
         );
         commit;`
    );
}

function createHostedClient(token: string) {
    return createTRPCClient<GrottoRouter>({
        links: [
            httpLink({
                headers: {
                    [appProtocolHeaders.productVersion]: 'e2e',
                    [appProtocolHeaders.protocolVersion]: String(appProtocolVersion),
                    authorization: `Bearer ${token}`,
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
        '--command',
        statement,
    ]).toString();
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
