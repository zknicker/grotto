import { attachComputer, createTestServer, openChannel, runPsql } from '../support/server.ts';
import { expect, test } from '../support/test.ts';

test('an Owner sees an Agent reminder on the Agent profile', async ({ page }) => {
    const { client, server, session } = await createTestServer(page, {
        displayName: 'Agent Reminders',
        slug: 'reminders',
    });
    const computer = await attachComputer(client, {
        credential: 'reminder-test-credential-1234567890',
        slug: 'reminders',
    });
    await openChannel(page, 'all');

    const chatId = server.channels.find((channel) => channel.name === 'all')?.id;
    if (!chatId) {
        throw new Error('The reminder fixture did not resolve #all.');
    }
    seedReminderState({
        chatId,
        computerId: computer.computerId,
        databaseUrl: session.databaseUrl,
        serverId: server.id,
    });

    await page.goto('/s/reminders/members');
    await page.getByRole('link', { name: 'Cove' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cove' })).toBeVisible();
    await page.getByRole('radio', { name: 'Reminders' }).click();
    await expect(page.getByText('Local watchdog', { exact: true })).toBeVisible();
    await expect(page.getByText(/daily@09:00/u)).toBeVisible();

    runPsql(
        session.databaseUrl,
        `update server_memberships set role = 'member'
         where server_id = '${server.id}'
           and user_id = (
             select id from users where clerk_user_id = 'user_e2e_human'
           )`
    );
    await page.reload();
    await page.getByRole('radio', { name: 'Reminders' }).click();
    await expect(page.getByText('No Reminders Yet', { exact: true })).toBeVisible();
    await expect(page.getByText('Local watchdog', { exact: true })).toHaveCount(0);
});

function seedReminderState(input: {
    chatId: string;
    computerId: string;
    databaseUrl: string;
    serverId: string;
}) {
    runPsql(
        input.databaseUrl,
        `begin;
         insert into agents (
           id, server_id, computer_id, handle, display_name, home_timezone, role,
           desired_runtime_id, desired_model_id
         ) values (
           'agt_e2e_reminder', '${input.serverId}', '${input.computerId}', 'reminder-cove', 'Cove',
           'America/New_York', 'member', 'codex', 'gpt-5.6-sol'
         );
         insert into channel_agent_participants (server_id, chat_id, agent_id)
         values ('${input.serverId}', '${input.chatId}', 'agt_e2e_reminder');
         insert into chat_messages (
           id, server_id, chat_id, sequence, system_author, content, nonce, created_at
         ) values (
           'msg_e2e_reminder_anchor', '${input.serverId}', '${input.chatId}', 1,
           'reminder', 'Reminder anchor', 'e2e-reminder-anchor',
           '2026-07-26T12:00:00.000Z'
         );
         update chats set last_message_sequence = 1
         where server_id = '${input.serverId}' and id = '${input.chatId}';
         insert into reminders (
           id, server_id, owner_agent_id, title, anchor_chat_id, anchor_message_id,
           fire_at, repeat, timezone, script, status, version, created_at, updated_at
         ) values (
           'rem_e2e_watchdog', '${input.serverId}', 'agt_e2e_reminder',
           'Local watchdog', '${input.chatId}', 'msg_e2e_reminder_anchor',
           '2099-07-27T13:00:00.000Z', 'daily@09:00', 'America/New_York',
           null, 'scheduled', 1,
           '2026-07-26T12:00:00.000Z', '2026-07-26T12:00:00.000Z'
         );
         commit;`
    );
}
