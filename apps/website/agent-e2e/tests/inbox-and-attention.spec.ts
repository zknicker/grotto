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

test('a direct mention wakes only the addressed Agent', async ({ page }) => {
    const { all, alpha, beta, harness, server, stamp } = suite;
    const head = await harness.readHead(all);
    const token = `HANDOFF-${stamp}`;

    await openChat(page, server.slug, all, 'all');
    await sendFromComposer(page, `@${alpha.handle} reply with exactly ${token}.`);
    await expectVisibleReply(page, token);
    await harness.waitForAgentQuiet(beta.id, 15_000, 300_000);

    const messages = await harness.readMessages(all);
    expect(cleanReplies(harness.authoredBy(messages, alpha.id, head))).toContain(token);
    expect(harness.authoredBy(messages, beta.id, head)).toEqual([]);
});

for (const kind of ['Channel', 'DM'] as const) {
    test(`${kind} FYI explicitly requiring no response stays silent`, async ({ page }) => {
        const { all, alpha, dm, harness, server, stamp } = suite;
        const chatId = kind === 'Channel' ? all : dm;
        const mention = kind === 'Channel' ? `@${alpha.handle} ` : '';
        const head = await harness.readHead(chatId);

        await openChat(page, server.slug, chatId, kind === 'Channel' ? 'all' : alpha.name);
        await sendFromComposer(
            page,
            `${mention}FYI only, no response needed: deploy ${stamp} finished cleanly.`
        );
        await harness.waitForAgentQuiet(alpha.id, 15_000, 300_000);

        expect(harness.authoredBy(await harness.readMessages(chatId), alpha.id, head)).toEqual([]);
    });
}

test('an ordinary DM receives one concise answer', async ({ page }) => {
    const { alpha, dm, harness, server } = suite;
    const head = await harness.readHead(dm);

    await openChat(page, server.slug, dm, alpha.name);
    await sendFromComposer(page, 'What is 7 multiplied by 6? Answer briefly.');

    const messages = await harness.pollMessages(
        dm,
        (items) => harness.authoredBy(items, alpha.id, head).length === 1,
        240_000
    );
    const replies = cleanReplies(harness.authoredBy(messages, alpha.id, head));
    expect(replies).toHaveLength(1);
    expect(replies[0]).toContain('42');
    await expectVisibleReply(page, replies[0] ?? '');
});

test('one Agent drains work from two Chats into the correct targets', async ({ page }) => {
    const { all, alpha, harness, product, server, stamp } = suite;
    const allHead = await harness.readHead(all);
    const productHead = await harness.readHead(product);
    const allToken = `ALL-${stamp}`;
    const productToken = `PRODUCT-${stamp}`;

    await openChat(page, server.slug, all, 'all');
    await sendFromComposer(page, `@${alpha.handle} reply here with exactly ${allToken}.`);
    await openChat(page, server.slug, product, 'product');
    await sendFromComposer(page, `@${alpha.handle} reply here with exactly ${productToken}.`);
    await expectVisibleReply(page, productToken);
    await openChat(page, server.slug, all, 'all');
    await expectVisibleReply(page, allToken);

    expect(
        cleanReplies(harness.authoredBy(await harness.readMessages(all), alpha.id, allHead))
    ).toContain(allToken);
    expect(
        cleanReplies(harness.authoredBy(await harness.readMessages(product), alpha.id, productHead))
    ).toContain(productToken);
});

async function setupSuite() {
    const harness = await createEvalHarness({ evalName: 'agente2e', repositoryRoot });
    const agents = await harness.requireAgents(2);
    const alpha = agents.find((agent) => agent.desiredModelId?.includes('terra')) ?? agents[0];
    const beta = agents.find((agent) => agent.id !== alpha.id) ?? agents[1];
    const all = await harness.requireChannel('all');
    const product = await harness.requireChannel('product');
    const dm = harness.requireDm(alpha);
    const servers = await harness.trpc('server.list');
    const server = servers.find((candidate) => candidate.id === harness.serverId);

    if (!server) {
        throw new Error(`Agent E2E could not resolve Server ${harness.serverId}`);
    }

    return {
        all,
        alpha,
        beta,
        dm,
        harness,
        product,
        server,
        stamp: harness.stamp,
    };
}

function cleanReplies(replies: string[]) {
    return replies.map((reply) => reply.trim());
}
