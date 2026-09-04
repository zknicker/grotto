import { seedOpenAsk } from '../support/agent-ask.ts';
import { createTestServer, openChannel } from '../support/server.ts';
import { expect, test } from '../support/test.ts';

const askTitle = 'Run the staged migration?';
const recommendedStep = 'Approve the staged migration';

test('an open Ask leads the Inbox, and its step answers in the Thread', async ({ page }) => {
    const { client, server, session } = await createTestServer(page, {
        displayName: 'Hosted Asks',
        slug: 'asks',
    });
    await client.member.updateProfile.mutate({
        description: null,
        displayName: 'Ada',
        handle: 'ada',
        serverId: server.id,
    });
    const seeded = await seedOpenAsk({
        addresseeHandle: 'ada',
        agentHandle: 'orbit',
        channelName: 'all',
        content: 'The migration is staged. Should I run it now?',
        databaseUrl: session.databaseUrl,
        recommendedStep,
        serverId: server.id,
        slug: 'asks',
        summary: 'The migration is staged and reversible for one hour.',
        title: askTitle,
        token: session.token,
    });

    await page.goto('/s/asks/inbox');
    const row = page.getByRole('row', { name: new RegExp(askTitle, 'u') });
    await expect(row).toBeVisible();
    await expect(row).toContainText('The migration is staged and reversible for one hour.');
    const step = page.getByRole('button', { exact: true, name: recommendedStep });
    await expect(step).toBeVisible();

    // Pressing the step is the human answering in their own words — the exact
    // step text, authored by them, in the Ask's Thread.
    await step.click();
    await expect(row).toHaveCount(0);
    await expect(page.getByText('Nothing needs you.')).toBeVisible();

    const thread = await client.chat.messages.query({
        chatId: seeded.threadChatId,
        serverId: server.id,
    });
    const answer = thread.messages.find((message) => message.content === recommendedStep);
    expect(answer?.author.kind).toBe('human');

    // The Chat keeps the settled Ask legible: the marker names who answered.
    await page.goto('/s/asks');
    await openChannel(page, 'all');
    const askRow = page
        .getByText('The migration is staged. Should I run it now?', { exact: true })
        .locator('xpath=ancestor::div[@data-message-id][1]');
    await expect(askRow.getByTestId('message-ask-marker')).toContainText('Answered by Ada');
});
