import {
    cloudAgentObservationFrame,
    seedCloudAgentWork,
    startCloudAgentWork,
} from '../support/agent-cloud-agent.ts';
import { sendBootstrap, socketMessage, socketOpen } from '../support/computer-socket.ts';
import { createTestServer, openChannel } from '../support/server.ts';
import { expect, test } from '../support/test.ts';

const workTitle = 'Fix the failing migration';
const credential = 'computer-cloud-agent-work-credential-12';

test('Cloud Agent work reads as a Chat surface header and an in-Thread card', async ({ page }) => {
    test.setTimeout(90_000);
    const { server, session } = await createTestServer(page, {
        displayName: 'Cloud Agent Work',
        slug: 'cloud-agent-work',
    });
    const seeded = await seedCloudAgentWork({
        agentHandle: 'orbit',
        channelName: 'all',
        computerCredential: credential,
        content: 'Delegating the migration fix to a Cloud Agent.',
        databaseUrl: session.databaseUrl,
        repository: 'grotto/grotto',
        serverId: server.id,
        slug: 'cloud-agent-work',
        startingRef: 'main',
        title: workTitle,
        token: session.token,
    });

    // The Inbox is where background work that outlives a turn stays visible.
    await page.goto('/s/cloud-agent-work/inbox');
    const inboxRow = page.getByRole('row', { name: new RegExp(workTitle, 'u') });
    await expect(inboxRow).toBeVisible();
    await expect(inboxRow).toContainText('Queued');
    await expect(inboxRow).toContainText('#all');
    await expect(inboxRow).toContainText('Orbit');

    // The Chat carries the same work as the header of its Thread surface.
    await page.goto('/s/cloud-agent-work');
    await openChannel(page, 'all');
    const header = page.getByTestId('cloud-agent-work-header');
    await expect(header).toContainText('Cursor');
    await expect(header).toContainText(workTitle);
    await expect(header).toContainText('Queued');

    // A Computer reporting progress updates the same header in place, with no
    // second Message: this is one record, not a transcript.
    const computer = new WebSocket(
        `ws://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/attachment`
    );
    await socketOpen(computer);
    const accepted = socketMessage(computer);
    sendBootstrap(computer, credential, 'complete');
    expect(await accepted).toMatchObject({ mode: 'ordinary' });

    computer.send(
        cloudAgentObservationFrame({
            activity: 'Reading the failing migration.',
            observedAt: new Date().toISOString(),
            runId: seeded.runId,
            status: 'running',
            workId: seeded.workId,
        })
    );
    await expect(header).toContainText('Running');
    await expect(page.getByTestId('cloud-agent-work-detail')).toContainText(
        'Reading the failing migration.'
    );

    // Inside the Thread the same record reads as the detailed card, in sequence
    // beneath the Agent's own words — which the card never replaced.
    await page.getByRole('button', { name: /^Open thread, Cloud Agent work/u }).click();
    const thread = page.getByRole('complementary', { name: 'Thread' });
    const card = thread.getByTestId('cloud-agent-work-card');
    await expect(card).toContainText('Running');
    await expect(card).toContainText('grotto/grotto');
    await expect(
        thread.getByText('Delegating the migration fix to a Cloud Agent.', { exact: true })
    ).toBeVisible();
    // The Thread pane states the work in the card alone; the old metadata panel
    // said the same facts a second time, above the anchor.
    await expect(thread.getByTestId('cloud-agent-work-header')).toHaveCount(0);

    computer.send(
        cloudAgentObservationFrame({
            branches: [
                {
                    branch: 'cursor/fix-migration',
                    pullRequestUrl: 'https://github.com/grotto/grotto/pull/482',
                    repository: 'grotto/grotto',
                },
            ],
            observedAt: new Date().toISOString(),
            runId: seeded.runId,
            status: 'completed',
            summary: 'Opened a pull request.',
            workId: seeded.workId,
        })
    );
    await expect(card).toContainText('Done');
    await expect(card).toContainText('cursor/fix-migration');
    await expect(card.getByTestId('cloud-agent-work-pull-request')).toContainText('PR #482');
    await expect(card.getByRole('button', { name: 'View PR' })).toBeVisible();
    await expect(card.getByTestId('cloud-agent-work-report')).toContainText(
        'Opened a pull request.'
    );

    // Settled work leaves "Happening now", which lists only live work.
    await page.goto('/s/cloud-agent-work/inbox');
    await expect(page.getByRole('row', { name: new RegExp(workTitle, 'u') })).toHaveCount(0);

    // Work delegated inside somebody else's Thread hoists its status onto that
    // Thread's own surface in the Chat, so a reader scanning back sees that
    // something is still running under it without opening anything.
    const nested = await startCloudAgentWork({
        agentId: seeded.agentId,
        chatId: seeded.chatId,
        computerCredential: credential,
        content: 'Following up inside the thread.',
        repository: 'grotto/grotto',
        target: `#all:${seeded.messageId}`,
        title: 'Backfill the migration test',
    });
    computer.send(
        cloudAgentObservationFrame({
            observedAt: new Date().toISOString(),
            runId: nested.runId,
            status: 'running',
            workId: nested.work.id,
        })
    );

    await page.goto('/s/cloud-agent-work');
    await openChannel(page, 'all');
    await expect(page.getByTestId('cloud-agent-work-status-mark')).toContainText('Running');
    computer.close();
});
