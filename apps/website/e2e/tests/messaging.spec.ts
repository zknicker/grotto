import { readFileSync } from 'node:fs';
import type { Locator } from '@playwright/test';
import { createAgentThreadSender } from '../support/agent-thread.ts';
import {
    clerkSessionFile,
    readClerkSessionFixture,
    signInAsClerkHuman,
} from '../support/clerk-session.ts';
import {
    assertOpaqueId,
    completeOnboarding,
    createClient,
    openChannel,
    openSection,
    runPsql,
} from '../support/server.ts';
import { expect, test } from '../support/test.ts';

test.beforeAll(async () => {
    const { databaseUrl, peerToken, token } = JSON.parse(
        readFileSync(clerkSessionFile(), 'utf8')
    ) as {
        databaseUrl: string;
        peerToken: string;
        token: string;
    };
    const owner = createClient(token);
    const peer = createClient(peerToken);
    await owner.server.create.mutate({
        displayName: 'Hosted Messages',
        slug: 'hosted-messages',
    });
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
    completeOnboarding(databaseUrl, serverId);
    runPsql(
        databaseUrl,
        `insert into server_memberships (id, server_id, user_id, role)
         values ('mem_e2e_peer', '${serverId}', '${peerUserId}', 'member');
         insert into channel_participants (server_id, chat_id, user_id)
         values ('${serverId}', '${allChatId}', '${peerUserId}')`
    );
    await owner.chat.send.mutate({
        chatId: allChatId,
        content: 'First durable human message',
        nonce: 'e2e-owner-baseline-message',
        serverId,
    });
    await peer.chat.send.mutate({
        chatId: allChatId,
        content: 'Peer-authored hosted message',
        nonce: 'e2e-peer-message',
        serverId,
    });
    seedArtifactThread({ chatId: allChatId, databaseUrl, serverId });
});

test('a human messages in #all with only the hosted Server online', async ({ page }) => {
    test.setTimeout(60_000);
    const localProductRequests: string[] = [];
    const retiredLocalOrigins = ['http://127.0.0.1:8080', 'http://127.0.0.1:18790'];

    page.on('request', (request) => {
        if (retiredLocalOrigins.some((origin) => request.url().startsWith(origin))) {
            localProductRequests.push(request.url());
        }
    });

    await signInAsClerkHuman(page);
    await page.goto('/s/hosted-messages');
    await openChannel(page, 'all');

    const composer = page.getByRole('textbox', { name: 'Message all' });
    await composer.fill('/status check');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(composer).toHaveText('/status check');
    await composer.fill('');
    await composer.fill('Browser-authored durable message');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Browser-authored durable message')).toBeVisible();
    await expect(page.getByTestId('read-state')).toContainText(/Read through \d+/u);

    await page.reload();
    await openChannel(page, 'all');
    await expect(page.getByText('Browser-authored durable message')).toBeVisible();
    await composer.fill('Second durable human message');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Second durable human message', { exact: true })).toBeVisible();

    const fileChooser = page.waitForEvent('filechooser');
    await page.getByLabel('Add attachments', { exact: true }).click();
    await (await fileChooser).setFiles({
        buffer: Buffer.from('hosted attachment bytes'),
        mimeType: 'text/plain',
        name: 'hosted-note.txt',
    });
    await expect(page.getByText('hosted-note.txt')).toBeVisible();
    await page.getByRole('button', { name: 'Send' }).click();
    const downloadButton = page.getByRole('button', { name: 'Download hosted-note.txt' });
    await expect(downloadButton).toBeVisible();
    const download = page.waitForEvent('download');
    await downloadButton.click();
    expect((await download).suggestedFilename()).toBe('hosted-note.txt');

    await expect(page.getByText('First durable human message', { exact: true })).toBeVisible();
    await expect(page.getByText('Second durable human message', { exact: true })).toBeVisible();

    // The sidebar renders as a treegrid, so its search row is a row, not a button.
    await page.getByRole('row', { name: 'Search' }).click();
    await page.getByPlaceholder('Search or run a command').fill('First durable');
    await page.getByText('See all results').click();
    // Results render as ItemCard buttons whose accessible name carries the
    // channel, author, and time alongside the matched text.
    await expect(page.getByRole('button', { name: /First durable human message/ })).toBeVisible();
    await openSection(page, 'Chat');
    await openChannel(page, 'all');

    const peerMessage = page.getByText('Peer-authored hosted message', { exact: true });
    await expect(peerMessage).toBeVisible();
    expect(localProductRequests).toEqual([]);
});

test('session rotation preserves the mounted chat and its unsent draft', async ({ page }) => {
    test.setTimeout(100_000);
    await signInAsClerkHuman(page);
    await page.goto('/s/hosted-messages');
    await openChannel(page, 'all');

    const composer = page.getByRole('textbox', { name: 'Message all' });
    await composer.fill('Keep this thought through session rotation');
    const mountedComposer = await composer.elementHandle();
    if (!mountedComposer) {
        throw new Error('The hosted composer did not mount before session rotation.');
    }

    const nextSocket = page.waitForEvent('websocket', { timeout: 40_000 });
    const { peerToken, rotatedToken } = readClerkSessionFixture();
    await page.evaluate((token) => {
        (
            window as Window & {
                __setE2eClerkSessionToken?: (nextToken: string) => void;
            }
        ).__setE2eClerkSessionToken?.(token);
    }, rotatedToken);
    await nextSocket;

    expect(await mountedComposer.evaluate((element) => element.isConnected)).toBe(true);
    await expect(composer).toHaveText('Keep this thought through session rotation');

    const server = await createClient(peerToken).server.bySlug.query({
        slug: 'hosted-messages',
    });
    const chatId = server.channels.find((channel) => channel.name === 'all')?.id;
    if (!chatId) {
        throw new Error('The hosted rotation test did not resolve #all.');
    }
    await createClient(peerToken).chat.send.mutate({
        chatId,
        content: 'Live peer message after session rotation',
        nonce: 'e2e-peer-after-session-rotation',
        serverId: server.id,
    });
    await expect(page.getByText('Live peer message after session rotation')).toBeVisible();
});

test('an Agent-authored artifact fence in a Thread opens the chat Artifact Pane', async ({
    page,
}) => {
    await signInAsClerkHuman(page);
    await page.goto('/s/hosted-messages');
    await openChannel(page, 'all');
    await page.setViewportSize({ height: 720, width: 800 });

    await page.getByRole('button', { name: /^1 reply/u }).click();

    const thread = page.getByRole('complementary', { name: 'Thread' });
    await expect(thread).toBeVisible();
    await expect(thread.getByText('```artifact', { exact: false })).toHaveCount(0);
    await thread.getByRole('textbox', { name: /Message Thread/u }).fill('Preserved draft');
    await thread.getByRole('button', { name: /Deterministic workspace audit/u }).click();

    const artifacts = page.getByRole('complementary', { name: 'Artifacts' });
    await expect(thread).toHaveCount(0);
    await expect(artifacts).toBeVisible();
    await expect(artifacts.getByRole('tab', { name: 'deterministic.html' })).toBeVisible();
    await expect(artifacts.getByText('Unable to browse this workspace.')).toBeVisible();

    await artifacts.getByRole('button', { name: 'Hide artifacts' }).click();
    await page.getByRole('button', { name: '1 reply' }).click();
    await expect(thread.getByRole('textbox', { name: /Message Thread/u })).toHaveText(
        'Preserved draft'
    );
});

test('a hosted Thread panel updates live and catches up after websocket reconnect', async ({
    page,
}) => {
    await signInAsClerkHuman(page);
    await page.goto('/s/hosted-messages');
    await openChannel(page, 'all');

    const anchorText = 'First durable human message';
    const anchorArticle = page
        .getByText(anchorText, { exact: true })
        .locator('xpath=ancestor::div[@data-message-id][1]');
    await openMessageThread(anchorArticle);

    const panel = page.getByRole('complementary', { name: 'Thread' });
    const openingWidth = await panel.evaluate((element) => element.getBoundingClientRect().width);
    await expect
        .poll(async () => (await panel.boundingBox())?.width ?? 0)
        .toBeGreaterThan(openingWidth + 20);
    await expect(panel).toBeVisible();
    await expect
        .poll(async () => {
            const [chatBox, panelBox] = await Promise.all([
                page.locator('[data-slot="chat-surface"]').boundingBox(),
                panel.boundingBox(),
            ]);

            return chatBox && panelBox ? Math.round(chatBox.y - panelBox.y) : null;
        })
        .toBe(48);
    const initialPane = await panel.elementHandle();
    if (!initialPane) {
        throw new Error('The hosted Thread test did not resolve the open pane.');
    }
    const artifactAnchor = page
        .getByText('Agent artifact fixture', { exact: true })
        .locator('xpath=ancestor::div[@data-message-id][1]');
    await openMessageThread(artifactAnchor);
    expect(
        await panel.evaluate(
            (currentPane, previousPane) => currentPane === previousPane,
            initialPane
        )
    ).toBe(true);
    await expect(panel.getByText('Agent artifact fixture', { exact: true })).toBeVisible();
    await openMessageThread(anchorArticle);
    await panel.getByRole('textbox', { name: /Message Thread/u }).fill('First hosted Thread reply');
    await panel.getByRole('button', { name: 'Send' }).click();
    await expect(panel.getByText('First hosted Thread reply', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Following' })).toBeVisible();
    await panel.getByRole('button', { name: 'Following' }).click();
    await expect(panel.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();

    const { peerToken, token } = JSON.parse(readFileSync(clerkSessionFile(), 'utf8')) as {
        peerToken: string;
        token: string;
    };
    const owner = createClient(token);
    const peer = createClient(peerToken);
    const server = await owner.server.bySlug.query({ slug: 'hosted-messages' });
    const parentChatId = server.channels.find((channel) => channel.name === 'all')?.id;
    if (!parentChatId) {
        throw new Error('The hosted Thread test did not resolve #all.');
    }
    const pageSnapshot = await owner.chat.messages.query({
        chatId: parentChatId,
        serverId: server.id,
    });
    const anchor = pageSnapshot.messages.find((message) => message.content === anchorText);
    if (!anchor) {
        throw new Error('The hosted Thread test did not resolve its anchor.');
    }

    await peer.chat.send.mutate({
        chatId: parentChatId,
        content: 'Live peer Thread reply',
        nonce: 'e2e-thread-live-reply',
        serverId: server.id,
        thread: { anchorMessageId: anchor.id },
    });
    await expect(panel.getByText('Live peer Thread reply', { exact: true })).toBeVisible();

    await page.evaluate(() => {
        const pane = document.querySelector('[aria-label="Thread"]');
        if (!pane) {
            throw new Error('Thread pane missing before close.');
        }
        const startedAt = performance.now();
        const removal = new Promise<number>((resolve) => {
            const observer = new MutationObserver(() => {
                if (!pane.isConnected) {
                    observer.disconnect();
                    resolve(performance.now() - startedAt);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
        (
            window as Window & {
                __threadCloseDuration?: Promise<number>;
            }
        ).__threadCloseDuration = removal;
    });
    await panel.getByRole('button', { name: 'Close thread' }).click();
    const closeDuration = await page.evaluate(
        () =>
            (
                window as Window & {
                    __threadCloseDuration?: Promise<number>;
                }
            ).__threadCloseDuration
    );
    expect(closeDuration).toBeGreaterThan(200);
    await expect(panel).toHaveCount(0);
    await peer.chat.send.mutate({
        chatId: parentChatId,
        content: 'Reply sent while the Thread was closed',
        nonce: 'e2e-thread-closed-reply',
        serverId: server.id,
        thread: { anchorMessageId: anchor.id },
    });
    await expect(page.getByRole('button', { name: /3 replies/u })).toBeVisible();
    await page.getByRole('button', { name: /3 replies/u }).click();
    await expect(
        panel.getByText('Reply sent while the Thread was closed', { exact: true })
    ).toBeVisible();

    await page.context().setOffline(true);
    await peer.chat.send.mutate({
        chatId: parentChatId,
        content: 'Reply sent while the App was offline',
        nonce: 'e2e-thread-offline-reply',
        serverId: server.id,
        thread: { anchorMessageId: anchor.id },
    });
    await page.context().setOffline(false);

    await expect(
        panel.getByText('Reply sent while the App was offline', { exact: true })
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Close thread' }).click();
    await expect(page.getByRole('button', { name: /4 replies/u })).toBeVisible();

    await page.setViewportSize({ height: 720, width: 800 });
    await page.getByRole('button', { name: /4 replies/u }).click();
    await expect(page.getByRole('button', { name: 'Back to chat' })).toBeVisible();
    await page.getByRole('button', { name: 'View in channel' }).click();
    await expect(panel).toHaveCount(0);
    await expect(
        page.getByLabel('Messages', { exact: true }).getByText(anchorText, { exact: true })
    ).toBeVisible();
});

test('an Agent reply reaches an already-open Thread live and after reconnect', async ({ page }) => {
    test.setTimeout(60_000);
    await signInAsClerkHuman(page);
    await page.goto('/s/hosted-messages');
    await openChannel(page, 'all');

    const anchorText = 'Agent delivery anchor';
    const composer = page.getByRole('textbox', { name: 'Message all' });
    await composer.fill(anchorText);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText(anchorText, { exact: true })).toBeVisible();

    // The human only OPENS the Thread; the Agent authors every reply through the
    // Server -> Computer path exactly as task clarifications and reminder
    // follow-ups arrive.
    const anchorArticle = page
        .getByText(anchorText, { exact: true })
        .locator('xpath=ancestor::div[@data-message-id][1]');
    await openMessageThread(anchorArticle);
    const panel = page.getByRole('complementary', { name: 'Thread' });
    await expect(panel).toBeVisible();

    const { databaseUrl, token } = JSON.parse(readFileSync(clerkSessionFile(), 'utf8')) as {
        databaseUrl: string;
        token: string;
    };
    const agent = await createAgentThreadSender({ anchorText, databaseUrl, token });

    // A live Agent reply renders in the already-open Thread with no refresh.
    await agent.send('Agent thread clarification', 'e2e-agent-thread-live');
    await expect(panel.getByText('Agent thread clarification', { exact: true })).toBeVisible();

    // A reply that lands while the Thread is closed must appear on reopen.
    await panel.getByRole('button', { name: 'Close thread' }).click();
    await agent.send('Agent reply while the thread was closed', 'e2e-agent-thread-closed');
    await expect(page.getByRole('button', { name: /2 replies/u })).toBeVisible();
    await page.getByRole('button', { name: /2 replies/u }).click();
    await expect(
        panel.getByText('Agent reply while the thread was closed', { exact: true })
    ).toBeVisible();

    // A reply authored while the App is offline is recovered on reconnect.
    await page.context().setOffline(true);
    await agent.send('Agent reply sent while the App was offline', 'e2e-agent-thread-offline');
    await page.context().setOffline(false);
    await expect(
        panel.getByText('Agent reply sent while the App was offline', { exact: true })
    ).toBeVisible();
});

function seedArtifactThread(input: { chatId: string; databaseUrl: string; serverId: string }) {
    runPsql(
        input.databaseUrl,
        `begin;
         insert into agents (
           id, server_id, handle, display_name, home_timezone, role
         ) values (
           'agt_e2e_artifact', '${input.serverId}', 'artifact-auditor',
           'Artifact Auditor', 'America/New_York', 'member'
         );
         insert into channel_agent_participants (server_id, chat_id, agent_id)
         values ('${input.serverId}', '${input.chatId}', 'agt_e2e_artifact');
         insert into chat_messages (
           id, server_id, chat_id, sequence, author_user_id, content, nonce
         )
         select
           'msg_e2e_artifact_anchor', '${input.serverId}', '${input.chatId}',
           last_message_sequence + 1,
           (
             select user_id from server_memberships
             where server_id = '${input.serverId}' and role = 'owner'
           ),
           'Agent artifact fixture', 'e2e-artifact-anchor'
         from chats
         where server_id = '${input.serverId}' and id = '${input.chatId}';
         update chats set last_message_sequence = last_message_sequence + 1
         where server_id = '${input.serverId}' and id = '${input.chatId}';
         insert into chats (
           id, server_id, kind, parent_chat_id, parent_chat_kind,
           anchor_message_id, last_message_sequence
         ) values (
           'cht_e2e_artifact_thread', '${input.serverId}', 'thread', '${input.chatId}',
           'channel', 'msg_e2e_artifact_anchor', 1
         );
         insert into chat_messages (
           id, server_id, chat_id, sequence, author_agent_id, content, nonce
         ) values (
           'msg_e2e_artifact_reply', '${input.serverId}', 'cht_e2e_artifact_thread', 1,
           'agt_e2e_artifact',
           E'Here is the audit.\\n\\u0060\\u0060\\u0060artifact\\n{"path":"audits/deterministic.html","title":"Deterministic workspace audit"}\\n\\u0060\\u0060\\u0060',
           'e2e-artifact-reply'
         );
         commit;`
    );
}

test('a signed-out human cannot read hosted messages', async ({ page }) => {
    await page.goto('/s/hosted-messages');

    await expect(page.getByText('Server unavailable')).toBeVisible();
    await expect(page.getByText('First durable human message')).toHaveCount(0);
});

test('Grotto App never requests a retired local product endpoint', async ({ page }) => {
    const localServerOrigin = 'http://127.0.0.1:8080';
    const localRequests: string[] = [];

    page.on('request', (request) => {
        if (request.url().startsWith(`${localServerOrigin}/trpc/`)) {
            localRequests.push(request.url());
        }
    });

    await signInAsClerkHuman(page);
    await page.goto('/s/hosted-messages');
    await openChannel(page, 'all');
    await expect(page.getByText('First durable human message')).toBeVisible();
    expect(localRequests).toEqual([]);
});

async function openMessageThread(message: Locator) {
    const messageRow = message.locator('xpath=ancestor::*[@data-slot="chat-message-assistant"][1]');
    await messageRow.hover();
    await messageRow.locator('button[aria-label="Reply in thread"]').click();
}
