import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createAgentFixture } from '../support/agent-fixture.ts';
import { startControlledMcp } from '../support/controlled-mcp.ts';
import {
    messageByContent,
    messageTimeline,
    openChat,
    openMessageThread,
    sendFromComposer,
} from '../support/live-agent-app.ts';
import { pollAgentReply } from '../support/task-replies.ts';

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
    const result = await pollAgentReply(
        harness,
        dm,
        agent.id,
        prompt,
        (content) => content.includes(first.title) && content.includes(first.owner),
        head
    );
    const reply = result.reply.content;

    if (result.threadChatId) {
        await openMessageThread(messageByContent(page, prompt));
    }
    const replySurface = result.threadChatId
        ? page.getByRole('complementary', { name: 'Thread' })
        : messageTimeline(page);
    await expect(replySurface.getByText(new RegExp(first.title, 'u'))).toBeVisible();
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
    const result = await pollAgentReply(harness, dm, agent.id, prompt, () => true, head);
    const reply = result.reply.content;

    expect(mcp.calls.filter((call) => call.key === second.key)).toHaveLength(0);
    expect(reply).not.toContain(second.title);
    expect(reply).not.toContain(second.owner);
});

async function setupSuite() {
    const fixture = await createAgentFixture({
        evalName: 'agentmcp',
        profiles: [
            {
                description: 'Uses only explicitly granted MCP connections.',
                name: 'MCP Auditor',
            },
        ],
        repositoryRoot,
    });
    let mcp: Awaited<ReturnType<typeof startControlledMcp>> | undefined;
    let connectionId: string | undefined;
    try {
        const [agent] = fixture.agents;
        if (!agent?.dmChatId) {
            throw new Error('MCP access needs one disposable Agent with an Owner DM.');
        }
        const servers = await fixture.harness.trpc('server.list');
        const server = servers.find(
            (candidate: { id: string }) => candidate.id === fixture.harness.serverId
        );
        if (!server) {
            throw new Error(`Agent E2E could not resolve Server ${fixture.harness.serverId}`);
        }

        mcp = await startControlledMcp();
        const connectionName = `Audit Ledger ${fixture.harness.stamp}`;
        const connection = await fixture.harness.trpc('mcp.add', {
            auth: 'none',
            headers: {},
            name: connectionName,
            oauthScopes: [],
            serverId: fixture.harness.serverId,
            url: mcp.url,
        });
        connectionId = connection.id;
        const first = {
            key: `BLUE-${fixture.harness.stamp}`,
            owner: `Owner-${fixture.harness.stamp}`,
            title: `Bluebird ${fixture.harness.stamp}`,
        };
        const second = {
            key: `EMBER-${fixture.harness.stamp}`,
            owner: `Private-${fixture.harness.stamp}`,
            title: `Ember ${fixture.harness.stamp}`,
        };
        mcp.define(first.key, first);
        mcp.define(second.key, second);

        return {
            agent,
            cleanup: () => cleanupSuite(fixture, mcp, connectionId),
            connectionName,
            dm: agent.dmChatId,
            first,
            harness: fixture.harness,
            mcp,
            second,
            server,
        };
    } catch (error) {
        try {
            await cleanupSuite(fixture, mcp, connectionId);
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'MCP setup and cleanup failed.');
        }
        throw error;
    }
}

async function cleanupSuite(
    fixture: Awaited<ReturnType<typeof createAgentFixture>>,
    mcp?: Awaited<ReturnType<typeof startControlledMcp>>,
    connectionId?: string
) {
    const failures: unknown[] = [];
    for (const cleanup of [
        async () => {
            if (connectionId) {
                await fixture.harness.trpc('mcp.delete', {
                    connectionId,
                    serverId: fixture.harness.serverId,
                });
            }
        },
        async () => mcp?.close(),
        fixture.cleanup,
    ]) {
        try {
            await cleanup();
        } catch (error) {
            failures.push(error);
        }
    }
    if (failures.length > 0) {
        throw new AggregateError(failures, 'MCP Agent E2E cleanup failed.');
    }
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
    await page.getByRole('radio', { name: 'Tools' }).click();
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
