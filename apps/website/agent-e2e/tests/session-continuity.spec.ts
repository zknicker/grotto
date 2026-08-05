import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { cleanupEvalChats } from '../support/cleanup-eval-chats.ts';
import {
    expectVisibleReply,
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

test('one Agent carries a fact from its DM into a Channel', async ({ page }) => {
    const { agent, all, channelName, dm, harness, server, stamp } = suite;
    const codename = `Kestrel-${stamp}`;

    await openChat(page, server.slug, dm, agent.name);
    await sendFromComposer(
        page,
        `For this launch exercise, remember that the deployment codename is ${codename}. Confirm briefly.`
    );
    await expect(page.getByText(codename, { exact: false })).toBeVisible({
        timeout: 240_000,
    });

    const channelHead = await harness.readHead(all);
    await openChat(page, server.slug, all, channelName);
    await sendFromComposer(
        page,
        `@${agent.handle} Without tools or files, what deployment codename did I just give you in DM? Reply only with it.`
    );
    await expectVisibleReply(page, codename);

    const replies = harness
        .authoredBy(await harness.readMessages(all), agent.id, channelHead)
        .map((reply) => reply.trim().toLowerCase());
    expect(replies).toContain(codename.toLowerCase());
});

test('an active Agent incorporates a message received mid-turn', async ({ page }) => {
    const { agent, all, channelName, harness, server, stamp } = suite;
    const color = `vermilion-${stamp}`;
    const prompt = `@${agent.handle} run the shell command "sleep 12". Then reply only with the release color from any message that arrived while you were working, or NO-COLOR if none arrived.`;

    await harness.waitForAgentQuiet(agent.id, 3000, 120_000);
    await openChat(page, server.slug, all, channelName);
    await sendFromComposer(page, prompt);
    await harness.waitForTurnActive(agent.id, 60_000);
    await sendFromComposer(page, `The release color for this exercise is ${color}.`);

    const task = await pollClaimedTask(harness, prompt, agent.id);
    const messages = await harness.pollMessages(
        task.task.threadChatId,
        (rows) =>
            harness
                .authoredBy(rows, agent.id)
                .some((reply) => reply.toLowerCase().includes(color.toLowerCase())),
        240_000
    );
    const reply = harness
        .authoredBy(messages, agent.id)
        .find((candidate) => candidate.toLowerCase().includes(color.toLowerCase()));

    expect(reply).toBeDefined();
    await openMessageThread(page.getByText(prompt, { exact: true }));
    await expect(
        page
            .getByRole('complementary', { name: 'Thread' })
            .getByText(reply?.trim() ?? color, { exact: true })
    ).toBeVisible();
});

async function setupSuite() {
    const harness = await createEvalHarness({ evalName: 'agentcontinuity', repositoryRoot });
    const templates = await harness.requireAgents(1);
    const template =
        templates.find((candidate) => candidate.desiredModelId?.includes('terra')) ?? templates[0];
    if (!(template.desiredRuntimeId && template.desiredModelId)) {
        throw new Error('Session continuity needs one configurable Terra Agent.');
    }

    let agent: AgentItem | undefined;
    let channel: { id: string } | undefined;
    try {
        const created = (await harness.trpc('agent.create', {
            computerId: template.computerId,
            description: 'Carries user context across Chats and active turns.',
            displayName: `Continuity ${harness.stamp.slice(-6)}`,
            handle: `continuity-${harness.stamp.slice(-8).toLowerCase()}`,
            modelId: template.desiredModelId,
            role: 'member',
            runtimeId: template.desiredRuntimeId,
            serverId: harness.serverId,
        })) as { agent: AgentItem };
        agent = await pollAgent(harness, created.agent.id);
        const channelName = `continuity-${harness.stamp.slice(-8)}`;
        channel = (await harness.trpc('chat.createChannel', {
            agentIds: [agent.id],
            name: channelName,
            serverId: harness.serverId,
        })) as { id: string };
        const servers = (await harness.trpc('server.list')) as ServerItem[];
        const server = servers.find((candidate) => candidate.id === harness.serverId);
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
        }
        const dm = harness.requireDm(agent);
        await harness.waitForAgentQuiet(agent.id, 3000, 120_000);

        return {
            agent: { ...agent, name: agent.displayName },
            all: channel.id,
            channelName,
            cleanup: () => cleanupSuiteResources(harness, channel, agent),
            dm,
            harness,
            server,
            stamp: harness.stamp,
        };
    } catch (error) {
        await cleanupSuiteResources(harness, channel, agent).catch(() => undefined);
        throw error;
    }
}

async function cleanupSuiteResources(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    channel?: { id: string },
    agent?: AgentItem
) {
    const failures: unknown[] = [];
    await cleanupEvalChats(harness, [channel?.id, agent?.dmChatId]).catch((error) =>
        failures.push(error)
    );
    await deleteAgent(harness, agent).catch((error) => failures.push(error));
    await harness.cleanup().catch((error: unknown) => failures.push(error));
    if (failures.length > 0) {
        throw new AggregateError(failures, 'Session continuity cleanup failed.');
    }
}

async function pollAgent(harness: Awaited<ReturnType<typeof createEvalHarness>>, agentId: string) {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        const agents = (await harness.trpc('agent.list', {
            serverId: harness.serverId,
        })) as AgentItem[];
        const agent = agents.find((candidate) => candidate.id === agentId);
        if (agent && agent.availability !== 'offline') {
            return agent;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`Timed out waiting for temporary Agent ${agentId}.`);
}

async function pollClaimedTask(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    content: string,
    agentId: string
) {
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
        const tasks = (await harness.trpc('task.list', {
            serverId: harness.serverId,
        })) as TaskItem[];
        const task = tasks.find(
            (item) => item.message.content === content && item.task.assigneeAgentId === agentId
        );
        if (task) {
            return task;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for the Agent to promote the active-turn message.');
}

async function deleteAgent(
    harness: Awaited<ReturnType<typeof createEvalHarness>>,
    agent?: AgentItem
) {
    if (!agent) {
        return;
    }
    await harness.trpc('agent.delete', {
        agentId: agent.id,
        confirmation: agent.displayName,
        serverId: harness.serverId,
    });
}

interface AgentItem {
    availability: string;
    computerId: string;
    desiredModelId: string;
    desiredRuntimeId: string;
    displayName: string;
    dmChatId: string | null;
    handle: string;
    id: string;
}

interface ServerItem {
    id: string;
    slug: string;
}

interface TaskItem {
    message: {
        content: string;
    };
    task: {
        assigneeAgentId: string | null;
        threadChatId: string;
    };
}
