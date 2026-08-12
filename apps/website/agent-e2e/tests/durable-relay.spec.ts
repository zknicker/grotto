import { expect, type Page, test } from '@playwright/test';
import { resolveThreadChatId, setupDurableRelaySuite } from '../support/durable-relay.ts';
import {
    messageByContent,
    openChat,
    openMessageThread,
    sendFromComposer,
} from '../support/live-agent-app.ts';

/**
 * User story: a fresh Agent can continue another Agent's sourced work from the durable
 * Thread and shared artifact without the human restating the assignment. The hidden
 * relay token proves recovery from product state rather than prompt leakage.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(720_000);

let suite: Awaited<ReturnType<typeof setupDurableRelaySuite>>;

test.beforeAll(async () => {
    suite = await setupDurableRelaySuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('a fresh Agent continues a sourced artifact handoff from its durable Thread', async ({
    page,
}) => {
    const {
        artifactPath,
        artifactTitle,
        author,
        channel,
        channelName,
        harness,
        server,
        successor,
        trackChatId,
    } = suite;

    const authorPrompt = [
        `@${author.handle} Build the first owner pass for a self-serve B2B SaaS choosing a 14-day or 30-day free trial.`,
        'Use only these supplied public evidence pages; do not search beyond them: https://docs.stripe.com/billing/subscriptions/trials https://developer.paddle.com/build/subscriptions/offer-free-trials https://www.chargebee.com/docs/2.0/trial_period.html',
        'Post a decision under 300 words with an explicit recommendation, all three source links, two risks, and a two-week validation plan.',
        'Generate one unpredictable token beginning DR- with at least 20 following letters or digits. Put it on a line beginning RELAY TOKEN: in both the Chat reply and artifact.',
        `Save a self-contained HTML brief at ${artifactPath} and share it as a Grotto artifact card titled "${artifactTitle}". A workspace link alone does not satisfy the requested artifact card.`,
        'Keep the inline reply complete enough that another Agent can verify it from canonical Thread history. Do not delegate.',
    ].join('\n');

    await Promise.all([
        harness.waitForAgentQuiet(author.id, 2000, 120_000),
        harness.waitForAgentQuiet(successor.id, 2000, 120_000),
    ]);
    await openChat(page, server.slug, channel, channelName);
    await sendFromComposer(page, authorPrompt);
    await openThread(page, authorPrompt);

    const threadChatId = await resolveThreadChatId(harness, channel, authorPrompt);
    trackChatId(threadChatId);
    const authorMessages = await pollAuthorHandoff();
    const authorOutput = authoredOutput(authorMessages, author.id);
    const relayToken = authorOutput.match(/RELAY TOKEN:\s*(DR-[A-Za-z0-9]{20,})/u)?.[1];
    if (!relayToken) {
        throw new Error('The first owner did not publish a recoverable relay token.');
    }
    const sourceUrls = extractUrls(authorOutput);
    expect(sourceUrls.length).toBeGreaterThanOrEqual(3);

    const artifact = (await harness.trpc('agent.workspaceFile', {
        agentId: author.id,
        path: artifactPath,
        serverId: harness.serverId,
    })) as { content: string; path: string };
    expect(artifact.path).toBe(artifactPath);
    expect(artifact.content).toContain(relayToken);
    expect(artifact.content.toLowerCase()).toContain('<html');

    const thread = page.getByRole('complementary', { name: 'Thread' });
    await thread.getByRole('button', { name: new RegExp(artifactTitle, 'u') }).click();
    const artifacts = page.getByRole('complementary', { name: 'Artifacts' });
    await expect(artifacts).toBeVisible();
    await expect(artifacts.locator(`iframe[title="${artifactPath}"]`)).toBeVisible({
        timeout: 60_000,
    });

    await harness.trpc('chat.updateChannel', {
        agentIds: [author.id, successor.id],
        chatId: channel,
        name: channelName,
        serverId: harness.serverId,
    });
    await harness.trpc('agent.reset', {
        agentId: successor.id,
        kind: 'session',
        serverId: harness.serverId,
    });

    await closeArtifacts(page);
    await reopenThread(page);
    const successorPrompt = [
        `@${successor.handle} Take over from the durable work already in this Thread without asking me to restate the assignment.`,
        'Recover the previous owner’s relay token, artifact path, recommendation, and evidence from canonical Thread history.',
        'Check whether those cited pages support the recommendation without opening new sources, amend any overstatement, and deliver a concise continuation under the exact headings EVIDENCE AMENDMENT, GO/NO-GO GATES, and NEXT ACTION.',
        'Repeat the recovered relay token and artifact path, and cite at least one source URL from the prior brief.',
    ].join('\n');
    await sendFromThread(page, successorPrompt);

    const successorMessages = await harness.pollMessages(
        threadChatId,
        (messages) =>
            messages.some(
                (message) =>
                    message.author.kind === 'agent' &&
                    message.author.agentId === successor.id &&
                    message.content.includes(relayToken) &&
                    message.content.includes(artifactPath) &&
                    message.content.includes('EVIDENCE AMENDMENT') &&
                    message.content.includes('GO/NO-GO GATES') &&
                    message.content.includes('NEXT ACTION') &&
                    sourceUrls.some((url) => message.content.includes(url))
            ),
        300_000
    );
    const successorReply = successorMessages.find(
        (message) =>
            message.author.kind === 'agent' &&
            message.author.agentId === successor.id &&
            message.content.includes(relayToken) &&
            message.content.includes(artifactPath) &&
            message.content.includes('EVIDENCE AMENDMENT') &&
            message.content.includes('GO/NO-GO GATES') &&
            message.content.includes('NEXT ACTION') &&
            sourceUrls.some((url) => message.content.includes(url))
    );
    if (!successorReply) {
        throw new Error('The successor did not deliver the durable continuation.');
    }

    expect(successorReply.content).toContain(relayToken);
    expect(successorReply.content).toContain(artifactPath);
    expect(sourceUrls.some((url) => successorReply.content.includes(url))).toBe(true);
    await expect(thread).toContainText(relayToken);
    await expect(thread).toContainText('EVIDENCE AMENDMENT');
    await expect(thread).toContainText('GO/NO-GO GATES');
    await expect(thread).toContainText('NEXT ACTION');

    async function pollAuthorHandoff() {
        try {
            return await harness.pollMessages(
                threadChatId,
                (messages) => {
                    const output = authoredOutput(messages, author.id);
                    return (
                        output.includes(artifactPath) &&
                        output.includes('```artifact') &&
                        /RELAY TOKEN:\s*DR-[A-Za-z0-9]{20,}/u.test(output) &&
                        extractUrls(output).length >= 3
                    );
                },
                300_000
            );
        } catch (error) {
            const messages = await harness.readMessages(threadChatId);
            const output = authoredOutput(messages, author.id);
            throw new Error(
                `Author handoff incomplete: path=${output.includes(artifactPath)} artifactCard=${output.includes('```artifact')} relayToken=${/RELAY TOKEN:\s*DR-[A-Za-z0-9]{20,}/u.test(output)} urls=${extractUrls(output).length}\n${output}`,
                { cause: error }
            );
        }
    }
});

async function openThread(page: Page, content: string) {
    await openMessageThread(messageByContent(page, content));
    await expect(page.getByRole('complementary', { name: 'Thread' })).toBeVisible();
}

async function sendFromThread(page: Page, content: string) {
    const thread = page.getByRole('complementary', { name: 'Thread' });
    const composer = thread.getByRole('textbox', { name: /Message Thread/u });
    await composer.fill(content);
    await thread.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(messageByContent(thread, content)).toBeVisible();
}

async function reopenThread(page: Page) {
    await page
        .getByRole('button', { name: /\d+ replies?/u })
        .last()
        .click();
    await expect(page.getByRole('complementary', { name: 'Thread' })).toBeVisible();
}

async function closeArtifacts(page: Page) {
    const artifacts = page.getByRole('complementary', { name: 'Artifacts' });
    await artifacts.getByRole('button', { name: 'Hide artifacts' }).click();
    await expect(artifacts).toBeHidden();
}

function extractUrls(content: string) {
    return [
        ...new Set(
            [...content.matchAll(/https?:\/\/[^\s)\]}>]+/gu)].map(([url]) =>
                url.replace(/[.,;:!?]+$/u, '')
            )
        ),
    ];
}

function authoredOutput(
    messages: Array<{ author: { agentId?: string; kind: string }; content: string }>,
    agentId: string
) {
    return messages
        .filter((message) => message.author.kind === 'agent' && message.author.agentId === agentId)
        .map((message) => message.content)
        .join('\n\n');
}
