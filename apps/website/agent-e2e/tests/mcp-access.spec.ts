import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createEvalHarness } from '../../../../scripts/eval-harness.mjs';
import { startControlledMcp } from '../support/controlled-mcp.ts';
import { messageTimeline, openChat, sendFromComposer } from '../support/live-agent-app.ts';

test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeAll(async () => {
    suite = await setupSuite();
});

test.afterAll(async () => {
    await suite?.cleanup();
});

test('an Agent uses an assigned Server-owned MCP connection', async ({ page }) => {
    const { agent, connectionName, dm, first, harness, mcp, server } = suite;
    await setGrant(page, server.slug, agent.id, connectionName, agent.name, true);

    const prompt = `Use the assigned Audit Ledger MCP to look up record ${first.key}. Reply with its exact title and owner. Do not guess.`;
    await openChat(page, server.slug, dm, agent.name);
    const head = await harness.readHead(dm);
    await sendFromComposer(page, prompt);
    const messages = await harness.pollMessages(
        dm,
        (items) =>
            harness
                .authoredBy(items, agent.id, head)
                .some((content) => content.includes(first.title) && content.includes(first.owner)),
        240_000
    );
    const reply = harness.authoredBy(messages, agent.id, head).join('\n');

    await expect(messageTimeline(page).getByText(new RegExp(first.title, 'u'))).toBeVisible();
    expect(reply).toContain(first.owner);
    expect(mcp.calls.filter((call) => call.key === first.key)).toHaveLength(1);
});

test('revoking the connection prevents a later lookup from returning private facts', async ({
    page,
}) => {
    const { agent, connectionName, dm, harness, mcp, second, server } = suite;
    await setGrant(page, server.slug, agent.id, connectionName, agent.name, false);

    const prompt = `Use the Audit Ledger MCP to look up the new record ${second.key}. Reply with its exact title and owner. Do not guess.`;
    await openChat(page, server.slug, dm, agent.name);
    const head = await harness.readHead(dm);
    await sendFromComposer(page, prompt);
    const messages = await harness.pollMessages(
        dm,
        (items) => harness.authoredBy(items, agent.id, head).length > 0,
        240_000
    );
    const reply = harness.authoredBy(messages, agent.id, head).join('\n');

    expect(mcp.calls.filter((call) => call.key === second.key)).toHaveLength(0);
    expect(reply).not.toContain(second.title);
    expect(reply).not.toContain(second.owner);
});

async function setupSuite() {
    const harness = await createEvalHarness({ evalName: 'agentmcp', repositoryRoot });
    const [agent] = await harness.requireAgents(1);
    const dm = harness.requireDm(agent);
    const servers = await harness.trpc('server.list');
    const server = servers.find((candidate: { id: string }) => candidate.id === harness.serverId);
    if (!server) {
        throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
    }

    const mcp = await startControlledMcp();
    const connectionName = `Audit Ledger ${harness.stamp}`;
    const connection = await harness.trpc('mcp.add', {
        auth: 'none',
        headers: {},
        name: connectionName,
        oauthScopes: [],
        serverId: harness.serverId,
        url: mcp.url,
    });
    const first = {
        key: `BLUE-${harness.stamp}`,
        owner: `Owner-${harness.stamp}`,
        title: `Bluebird ${harness.stamp}`,
    };
    const second = {
        key: `EMBER-${harness.stamp}`,
        owner: `Private-${harness.stamp}`,
        title: `Ember ${harness.stamp}`,
    };
    mcp.define(first.key, first);
    mcp.define(second.key, second);

    return {
        agent,
        cleanup: async () => {
            await harness
                .trpc('mcp.delete', {
                    connectionId: connection.id,
                    serverId: harness.serverId,
                })
                .catch(() => undefined);
            await mcp.close();
            await harness.cleanup();
        },
        connectionName,
        dm,
        first,
        harness,
        mcp,
        second,
        server,
    };
}

async function setGrant(
    page: Parameters<typeof openChat>[0],
    serverSlug: string,
    agentId: string,
    connectionName: string,
    agentName: string,
    enabled: boolean
) {
    await page.goto(`/s/${serverSlug}/members/agents/${agentId}`);
    await page.getByRole('radio', { name: 'Overview' }).click();
    await expect(page.getByRole('heading', { name: 'Agent MCP Access' })).toBeVisible();
    const grant = page.getByRole('switch', {
        name: `Enable ${connectionName} for ${agentName}`,
    });
    await expect(grant).toBeVisible();
    if ((await grant.isChecked()) !== enabled) {
        await grant.press('Space');
    }
    await expect(grant).toBeChecked({ checked: enabled });
}
