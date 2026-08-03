import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import {
    messageTimeline,
    openChat,
    openMessageThread,
    sendFromComposer,
} from '../support/live-agent-app.ts';

/**
 * User story: an Owner can equip an Agent with a skill, rely on Agent-owned files across
 * fresh sessions, and share a workspace artifact that opens the exact file in the App.
 * The gates protect durable capability changes and workspace identity, not model prose.
 */
test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const skillName = 'decision-helper';
let suite: Awaited<ReturnType<typeof setupSuite>>;
let teardown: {
    agentId: string;
    harness: Awaited<ReturnType<typeof createEvalHarness>>;
    name: string;
} | null = null;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    await cleanupSuite();
});

test('an imported skill shapes the Agent next turn', async ({ page }) => {
    const { agent, harness, server } = suite;
    await page.goto(`/s/${server.slug}/members/agents/${agent.id}`);
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
    const { reply } = await runTask(
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

    const thread = page.getByRole('complementary', { name: 'Thread' });
    await thread.getByRole('button', { name: new RegExp(suite.artifactTitle, 'u') }).click();
    const artifacts = page.getByRole('complementary', { name: 'Artifacts' });
    await expect(artifacts).toBeVisible();
    const preview = artifacts.locator(`iframe[title="${suite.artifactPath}"]`);
    await expect(preview).toBeVisible({ timeout: 60_000 });
    await expect(
        preview.contentFrame().getByText(suite.artifactMarker, { exact: true })
    ).toBeVisible();
});

async function setupSuite() {
    const harness = await createEvalHarness({ evalName: 'agentskillsworkspace', repositoryRoot });
    const templates = (await harness.trpc('agent.list', {
        serverId: harness.serverId,
    })) as AgentItem[];
    const template = templates.find(
        (candidate) =>
            candidate.availability !== 'offline' &&
            candidate.desiredModelId.toLowerCase().includes('terra') &&
            candidate.status === 'applied'
    );
    if (!template) {
        await harness.cleanup();
        throw new Error('Agent E2E needs an applied online Terra Agent configuration.');
    }
    const servers = await harness.trpc('server.list');
    const server = servers.find((candidate: { id: string }) => candidate.id === harness.serverId);
    if (!server) {
        await harness.cleanup();
        throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
    }

    const name = `Sable ${harness.stamp.slice(-6)}`;
    const created = (await harness.trpc('agent.create', {
        computerId: template.computerId,
        description: 'Disposable skills and workspace audit Agent.',
        displayName: name,
        handle: `sable-${harness.stamp.slice(-8).toLowerCase()}`,
        modelId: template.desiredModelId,
        role: 'member',
        runtimeId: template.desiredRuntimeId,
        serverId: harness.serverId,
    })) as { agent: AgentItem; chat: { id: string } };
    teardown = { agentId: created.agent.id, harness, name };
    const agent = await pollAgent(harness, created.agent.id);
    return {
        agent,
        artifactMarker: `ARTIFACT-${harness.stamp}`,
        artifactPath: `audits/agent-e2e-${harness.stamp}.html`,
        artifactTitle: `Workspace audit ${harness.stamp}`,
        dm: created.chat.id,
        harness,
        server,
        workspacePath: `audits/agent-e2e-${harness.stamp}.md`,
    };
}

async function cleanupSuite() {
    const current = teardown;
    teardown = null;
    if (!current) {
        return;
    }

    let failure: unknown;
    try {
        await Promise.race([
            current.harness.trpc('agent.delete', {
                agentId: current.agentId,
                confirmation: current.name,
                serverId: current.harness.serverId,
            }),
            new Promise((_, reject) => {
                setTimeout(
                    () => reject(new Error('temporary Agent deletion timed out after 30s')),
                    30_000
                );
            }),
        ]);
        await pollAgentAbsent(current.harness, current.agentId);
    } catch (error) {
        failure = error;
    } finally {
        await current.harness.cleanup();
    }
    if (failure) {
        throw new Error(
            `Failed to remove temporary Agent ${current.name} (${current.agentId}): ${String(failure)}`
        );
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
    const { messages, threadChatId } = await pollReplyLocation(
        current.harness,
        current.dm,
        current.agent.id,
        prompt,
        complete
    );
    const reply =
        current.harness.authoredBy(messages, current.agent.id).find(complete) ??
        current.harness.authoredBy(messages, current.agent.id).at(-1) ??
        '';

    if (threadChatId) {
        await openThread(page, prompt);
    }
    return { reply, threadChatId };
}

async function pollAgent(harness: Awaited<ReturnType<typeof createEvalHarness>>, agentId: string) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        const agent = agents.find((candidate) => candidate.id === agentId);
        if (agent?.status === 'applied' && agent.availability !== 'offline') {
            return { ...agent, name: agent.displayName };
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for Agent ${agentId} to become ready.`);
}

async function pollAgentAbsent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agentId: string
) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        if (!agents.some((candidate) => candidate.id === agentId)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for temporary Agent ${agentId} to disappear.`);
}

async function pollReplyLocation(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    dmChatId: string,
    agentId: string,
    content: string,
    complete: (content: string) => boolean
) {
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
        const [tasks, directMessages] = await Promise.all([
            harness.trpc('task.list', { serverId: harness.serverId }) as Promise<TaskItem[]>,
            harness.readMessages(dmChatId),
        ]);
        const task = tasks.find((item) => item.message.content === content);
        if (harness.authoredBy(directMessages, agentId).some(complete)) {
            return { messages: directMessages, threadChatId: undefined };
        }
        if (task) {
            const threadMessages = await harness.readMessages(task.task.threadChatId);
            if (harness.authoredBy(threadMessages, agentId).some(complete)) {
                return { messages: threadMessages, threadChatId: task.task.threadChatId };
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for the skill/workspace Agent reply.');
}

async function openThread(page: Page, content: string) {
    await openMessageThread(page.getByText(content, { exact: true }));
}

interface TaskItem {
    message: {
        content: string;
    };
    task: {
        threadChatId: string;
    };
}

interface AgentItem {
    availability: 'error' | 'idle' | 'offline' | 'stopped' | 'working';
    computerId: string;
    desiredModelId: string;
    desiredRuntimeId: string;
    displayName: string;
    id: string;
    status: 'applied' | 'degraded' | 'pending';
}
