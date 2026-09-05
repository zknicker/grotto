import { cloudAgentObservationFrame, seedCloudAgentWork } from '../support/agent-cloud-agent.ts';
import { sendBootstrap, socketMessage, socketOpen } from '../support/computer-socket.ts';
import { createTestServer, openChannel } from '../support/server.ts';
import { expect, test } from '../support/test.ts';

const workTitle = 'Fix the failing migration';
const credential = 'computer-cloud-agent-work-credential-12';

test('Cloud Agent work reads as one updating header in Chat and in the Inbox', async ({ page }) => {
    test.setTimeout(60_000);
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

    computer.send(
        cloudAgentObservationFrame({
            observedAt: new Date().toISOString(),
            runId: seeded.runId,
            status: 'completed',
            summary: 'Opened a pull request.',
            workId: seeded.workId,
        })
    );
    await expect(header).toContainText('Done');
    await expect(page.getByTestId('cloud-agent-work-detail')).toContainText(
        'Opened a pull request.'
    );
    // The Agent's own words stay the Message; the card never replaced them.
    await expect(
        page.getByText('Delegating the migration fix to a Cloud Agent.', { exact: true })
    ).toBeVisible();

    // Settled work leaves "Happening now", which lists only live work.
    await page.goto('/s/cloud-agent-work/inbox');
    await expect(page.getByRole('row', { name: new RegExp(workTitle, 'u') })).toHaveCount(0);
    computer.close();
});
