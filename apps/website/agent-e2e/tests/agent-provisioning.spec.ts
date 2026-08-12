import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, test } from '@playwright/test';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import {
    messageByContent,
    openChat,
    openMessageThread,
    sendFromComposer,
} from '../support/live-agent-app.ts';

test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('an Owner can provision, use, inspect, and retire a general-purpose Agent', async ({
    page,
}) => {
    test.setTimeout(600_000);
    const { harness, name, prompt, server } = suite;

    await page.goto(`/s/${server.slug}/members`);
    await page.getByRole('button', { name: 'Create agent' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create Agent' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
    await dialog
        .getByRole('textbox', { name: 'Description' })
        .fill('Temporary launch-copy reviewer for the Agent E2E audit.');
    await dialog.getByLabel('Model').click();
    await page.getByRole('option', { name: 'GPT-5.6 Terra' }).click();
    await dialog.getByRole('button', { name: 'Create Agent', exact: true }).click();

    const agent = await pollAgent(harness, (candidate) => candidate.displayName === name);
    suite.agentId = agent.id;
    await expect(page).toHaveURL(new RegExp(`/s/${server.slug}/members/agents/${agent.id}`, 'u'));
    await expect(page.getByText('GPT-5.6 Terra', { exact: true })).toBeVisible();
    await expect(page.getByText(/^idle$/iu)).toBeVisible({
        timeout: 60_000,
    });
    await page.getByRole('radio', { name: 'Tools' }).click();
    await expect(page.getByRole('button', { name: 'visuals' })).toBeVisible();

    if (!agent.dmChatId) {
        throw new Error(`${name} did not receive an Owner DM.`);
    }
    await openChat(page, server.slug, agent.dmChatId, name);
    await sendFromComposer(page, prompt);

    const threadChatId = await pollThreadChatId(harness, agent.dmChatId, prompt);
    const messages = await harness.pollMessages(
        threadChatId,
        (items) =>
            harness
                .authoredBy(items, agent.id)
                .some((content) => content.toLowerCase().includes('bluebird-brief.md')),
        240_000
    );
    const result = harness.authoredBy(messages, agent.id).at(-1)?.trim() ?? '';

    await openMessageThread(messageByContent(page, prompt));
    const thread = page.getByRole('complementary', { name: 'Thread' });
    await expectResultVisible(thread);
    expect(result.toLowerCase()).toContain('bluebird-brief.md');

    await page.goto(`/s/${server.slug}/members/agents/${agent.id}`);
    await page.getByRole('radio', { name: 'Workspace' }).click();
    await expect(page.getByRole('treeitem', { name: 'MEMORY.md' })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'notes' })).toHaveCount(0);
    await expect(page.getByRole('treeitem', { name: 'bluebird-brief.md' })).toBeVisible();

    await page.getByRole('radio', { name: 'Overview' }).click();
    await page.getByRole('button', { name: 'Delete Agent' }).click();
    const confirmation = page.getByRole('alertdialog');
    await confirmation
        .getByLabel(new RegExp(`Type ${escapeRegExp(name)} to confirm`, 'u'))
        .fill(name);
    await confirmation.getByRole('button', { name: 'Delete Agent' }).click();

    await expect(page).toHaveURL(new RegExp(`/s/${server.slug}/members$`, 'u'));
    await expect(page.getByRole('row', { name: new RegExp(name, 'u') })).toHaveCount(0);
    suite.agentId = null;
});

async function setupSuite() {
    const harness = await createEvalHarness({ evalName: 'agentprovisioning', repositoryRoot });
    const servers = await harness.trpc('server.list');
    const server = servers.find((candidate: { id: string }) => candidate.id === harness.serverId);

    if (!server) {
        throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
    }

    const name = `Juniper ${harness.stamp.slice(-6)}`;
    return {
        agentId: null as string | null,
        cleanup: async () => {
            if (suite?.agentId) {
                await harness
                    .trpc('agent.delete', {
                        agentId: suite.agentId,
                        confirmation: name,
                        serverId: harness.serverId,
                    })
                    .catch(() => undefined);
            }
            await harness.cleanup();
        },
        harness,
        name,
        prompt: `We’re preparing the Bluebird launch. Create a short note named bluebird-brief.md with three headings: Audience, Risks, Next questions. Tell me when it’s ready. Audit reference ${harness.stamp}.`,
        server,
    };
}

async function pollAgent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    predicate: (agent: AgentItem) => boolean
) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        const agent = agents.find(predicate);
        if (agent?.status === 'applied' && agent.availability !== 'offline') {
            return agent;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for the provisioned Agent to become ready.');
}

async function pollThreadChatId(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    chatId: string,
    anchor: string
) {
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
        const page = (await harness.trpc('chat.messages', {
            chatId,
            serverId: harness.serverId,
        })) as ChatPage;
        const anchorMessage = page.messages.find((message) => message.content === anchor);
        const thread = page.threads.find(
            (candidate) => candidate.anchorMessageId === anchorMessage?.id
        );
        if (thread) {
            return thread.threadChatId;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for the provisioned Agent reply Thread.');
}

async function expectResultVisible(thread: Locator) {
    await expect(thread.getByRole('link', { name: 'bluebird-brief.md' })).toBeVisible();
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

interface AgentItem {
    availability: 'error' | 'idle' | 'offline' | 'stopped' | 'working';
    displayName: string;
    dmChatId: string | null;
    id: string;
    status: 'applied' | 'degraded' | 'pending';
}

interface ChatPage {
    messages: Array<{ content: string; id: string }>;
    threads: Array<{ anchorMessageId: string; threadChatId: string }>;
}
