import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { createAgentFixture } from '../support/agent-fixture.ts';
import {
    messageByContent,
    messageTimeline,
    openChat,
    openMessageThread,
    sendFromComposer,
} from '../support/live-agent-app.ts';
import { pollAgentReply } from '../support/task-replies.ts';

/**
 * User story: an Owner can equip an Agent with a skill, rely on Agent-owned files across
 * fresh sessions, and share a workspace artifact that opens the exact file in the App.
 * The gates protect durable capability changes and workspace identity, not model prose.
 */
test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const skillName = 'decision-helper';
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('an imported skill shapes the Agent next turn', async ({ page }) => {
    const { agent, harness, server } = suite;
    await page.goto(`/s/${server.slug}/members/agents/${agent.id}`);
    await page.getByRole('radio', { name: 'Tools' }).click();
    await page.getByRole('button', { name: 'Add skills' }).click();
    await page.getByRole('button', { name: 'Add Decision Helper' }).click();
    await expect(page.getByRole('button', { name: skillName, exact: true })).toBeVisible({
        timeout: 60_000,
    });
    const prompt = `Use $decision-helper to compare a staged launch with a big-bang launch. Follow the skill’s required output headings and include audit marker ${harness.stamp} under Decision.`;
    const { reply, threadChatId } = await runTask(page, suite, prompt, (content) =>
        [
            '## Decision',
            '## Options',
            '## Decision Matrix',
            '## Recommendation',
            '## Next Steps',
        ].every((heading) => content.includes(heading))
    );

    expect(reply).toContain(harness.stamp);
    const replySurface = threadChatId
        ? page.getByRole('complementary', { name: 'Thread' })
        : messageTimeline(page);
    await expect(replySurface.getByText('Decision Matrix', { exact: true })).toBeVisible();
    expect(threadChatId).toMatch(/^cht_/u);
});

test('a new session recovers the exact Agent-owned workspace file', async ({ page }) => {
    const { agent, harness } = suite;
    const createPrompt = `Create ${suite.workspacePath} in your workspace. Generate a fresh unpredictable marker beginning FILE- with at least 20 characters, and save it on a line beginning "Workspace marker:". Do not reveal the marker in Chat; reply only SAVED when the file is durable.`;
    const { reply: savedReply } = await runTask(
        page,
        suite,
        createPrompt,
        (content) => content.trim() === 'SAVED'
    );
    expect(savedReply.trim()).toBe('SAVED');

    const file = (await harness.trpc('agent.workspaceFile', {
        agentId: agent.id,
        path: suite.workspacePath,
        serverId: harness.serverId,
    })) as { content: string; path: string };
    expect(file.path).toBe(suite.workspacePath);
    const marker = file.content.match(/Workspace marker:\s*(FILE-[A-Za-z0-9_-]{15,})/u)?.[1];
    expect(marker).toBeTruthy();
    if (!marker) {
        throw new Error('The Agent workspace file did not contain the generated marker.');
    }
    expect(savedReply).not.toContain(marker);

    await harness.waitForAgentQuiet(agent.id, 2000, 60_000);
    await harness.trpc('agent.reset', {
        agentId: agent.id,
        kind: 'session',
        serverId: harness.serverId,
    });

    const readPrompt = `Read ${suite.workspacePath} from your workspace. Reply only with the complete "Workspace marker:" line from that file.`;
    const { reply, threadChatId } = await runTask(page, suite, readPrompt, (content) =>
        content.includes(marker)
    );
    expect(reply).toContain(marker);

    const replySurface = threadChatId ? page.getByRole('complementary', { name: 'Thread' }) : page;
    await expect(replySurface.getByText(marker, { exact: false })).toBeVisible();
});

test('an Agent-authored HTML artifact opens with the exact workspace bytes', async ({ page }) => {
    const { agent, harness } = suite;
    const prompt = `Create a self-contained HTML status page at ${suite.artifactPath}. Its visible heading must be exactly "${suite.artifactMarker}". Share it here as a clickable artifact titled "${suite.artifactTitle}", not only as a text link.`;
    const { reply, threadChatId } = await runTask(
        page,
        suite,
        prompt,
        (content) =>
            content.includes('```artifact') &&
            content.includes(suite.artifactPath) &&
            content.includes(suite.artifactTitle)
    );
    expect(reply).toContain(suite.artifactPath);

    const file = (await harness.trpc('agent.workspaceFile', {
        agentId: agent.id,
        path: suite.artifactPath,
        serverId: harness.serverId,
    })) as { content: string; path: string };
    expect(file.path).toBe(suite.artifactPath);
    expect(file.content).toContain(suite.artifactMarker);

    const replySurface = threadChatId
        ? page.getByRole('complementary', { name: 'Thread' })
        : messageTimeline(page);
    await replySurface.getByRole('button', { name: new RegExp(suite.artifactTitle, 'u') }).click();
    const artifacts = page.getByRole('complementary', { name: 'Artifacts' });
    await expect(artifacts).toBeVisible();
    const preview = artifacts.locator(`iframe[title="${suite.artifactPath}"]`);
    await expect(preview).toBeVisible({ timeout: 60_000 });
    await expect(
        preview.contentFrame().getByText(suite.artifactMarker, { exact: true })
    ).toBeVisible();
});

async function setupSuite() {
    const fixture = await createAgentFixture({
        evalName: 'agentskillsworkspace',
        profiles: [
            {
                description: 'Audits imported skills, workspace continuity, and artifacts.',
                name: 'Workspace Auditor',
            },
        ],
        repositoryRoot,
    });
    try {
        const [agent] = fixture.agents;
        if (!agent?.dmChatId) {
            throw new Error('Skills and workspace needs one disposable Agent with an Owner DM.');
        }
        const servers = await fixture.harness.trpc('server.list');
        const server = servers.find(
            (candidate: { id: string }) => candidate.id === fixture.harness.serverId
        );
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${fixture.harness.serverId}`);
        }
        return {
            ...fixture,
            agent,
            artifactMarker: `ARTIFACT-${fixture.harness.stamp}`,
            artifactPath: `audits/agent-e2e-${fixture.harness.stamp}.html`,
            artifactTitle: `Workspace audit ${fixture.harness.stamp}`,
            dm: agent.dmChatId,
            server,
            workspacePath: `audits/agent-e2e-${fixture.harness.stamp}.md`,
        };
    } catch (error) {
        await fixture.cleanup();
        throw error;
    }
}

async function runTask(
    page: Page,
    current: Awaited<ReturnType<typeof setupSuite>>,
    prompt: string,
    complete: (content: string) => boolean
) {
    await openChat(page, current.server.slug, current.dm, current.agent.name);
    await sendFromComposer(page, prompt);
    const result = await pollAgentReply(
        current.harness,
        current.dm,
        current.agent.id,
        prompt,
        complete
    );

    if (result.threadChatId) {
        await openThread(page, prompt);
    }
    return { reply: result.reply.content, threadChatId: result.threadChatId };
}

async function openThread(page: Page, content: string) {
    await openMessageThread(messageByContent(page, content));
}
