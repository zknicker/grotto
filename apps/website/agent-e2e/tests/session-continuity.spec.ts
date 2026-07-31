import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { expectVisibleReply, openChat, sendFromComposer } from '../support/live-agent-app.ts';

test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    await suite?.harness.cleanup();
});

test('one Agent carries a fact from its DM into a Channel', async ({ page }) => {
    const { agent, all, dm, harness, server, stamp } = suite;
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
    await openChat(page, server.slug, all, 'all');
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
    const { agent, all, harness, server, stamp } = suite;
    const color = `vermilion-${stamp}`;

    await harness.waitForAgentQuiet(agent.id, 3000, 120_000);
    const head = await harness.readHead(all);
    await openChat(page, server.slug, all, 'all');
    await sendFromComposer(
        page,
        `@${agent.handle} run the shell command "sleep 12". Then reply only with the release color from any message that arrived while you were working, or NO-COLOR if none arrived.`
    );
    await harness.waitForTurnActive(agent.id, 60_000);
    await sendFromComposer(page, `The release color for this exercise is ${color}.`);

    const messages = await harness.pollMessages(
        all,
        (rows) =>
            harness
                .authoredBy(rows, agent.id, head)
                .some((reply) => reply.toLowerCase().includes(color.toLowerCase())),
        240_000
    );
    const reply = harness
        .authoredBy(messages, agent.id, head)
        .find((candidate) => candidate.toLowerCase().includes(color.toLowerCase()));

    expect(reply).toBeDefined();
    await expectVisibleReply(page, reply?.trim() ?? color);
});

async function setupSuite() {
    const harness = await createEvalHarness({ evalName: 'agentcontinuity', repositoryRoot });
    const agents = await harness.requireAgents(1);
    const agent =
        agents.find((candidate) => candidate.desiredModelId?.includes('terra')) ?? agents[0];
    const all = await harness.requireChannel('all');
    const dm = harness.requireDm(agent);
    const servers = await harness.trpc('server.list');
    const server = servers.find((candidate) => candidate.id === harness.serverId);

    if (!server) {
        throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
    }

    return { agent, all, dm, harness, server, stamp: harness.stamp };
}
