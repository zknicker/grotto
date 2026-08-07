import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createAgentChannelFixture } from '../support/agent-channel-fixture.ts';
import { expectVisibleReply, openChat, sendFromComposer } from '../support/live-agent-app.ts';

test.describe.configure({ mode: 'serial' });

const repositoryRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
let suite: Awaited<ReturnType<typeof setupSuite>>;

test.beforeEach(async () => {
    suite = await setupSuite();
});

test.afterEach(async () => {
    await suite?.cleanup();
});

test('a direct mention wakes only the addressed Agent', async ({ page }) => {
    const { all, alpha, beta, harness, server, stamp } = suite;
    const head = await harness.readHead(all);
    const token = `HANDOFF-${stamp}`;

    await openChat(page, server.slug, all, suite.allName);
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

        await openChat(page, server.slug, chatId, kind === 'Channel' ? suite.allName : alpha.name);
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
    const { all, allName, alpha, harness, product, productName, server, stamp } = suite;
    const allHead = await harness.readHead(all);
    const productHead = await harness.readHead(product);
    const allToken = `ALL-${stamp}`;
    const productToken = `PRODUCT-${stamp}`;

    await openChat(page, server.slug, all, allName);
    await sendFromComposer(page, `@${alpha.handle} reply here with exactly ${allToken}.`);
    await openChat(page, server.slug, product, productName);
    await sendFromComposer(page, `@${alpha.handle} reply here with exactly ${productToken}.`);
    await expectVisibleReply(page, productToken);
    const productMessages = await harness.pollMessages(
        product,
        (messages) =>
            cleanReplies(harness.authoredBy(messages, alpha.id, productHead)).some((reply) =>
                reply.includes(productToken)
            ),
        240_000
    );
    await openChat(page, server.slug, all, allName);
    await expectVisibleReply(page, allToken);
    const allMessages = await harness.pollMessages(
        all,
        (messages) =>
            cleanReplies(harness.authoredBy(messages, alpha.id, allHead)).some((reply) =>
                reply.includes(allToken)
            ),
        240_000
    );

    expect(cleanReplies(harness.authoredBy(allMessages, alpha.id, allHead)).join('\n')).toContain(
        allToken
    );
    expect(
        cleanReplies(harness.authoredBy(productMessages, alpha.id, productHead)).join('\n')
    ).toContain(productToken);
});

async function setupSuite() {
    const fixture = await createAgentChannelFixture({
        channelPrefix: 'inbox-all',
        evalName: 'agente2e',
        profiles: [
            {
                description: 'Tests direct attention and exact Chat delivery.',
                name: 'Inbox Alpha',
            },
            {
                description: 'Remains silent unless directly addressed.',
                name: 'Inbox Beta',
            },
        ],
        repositoryRoot,
    });
    try {
        const [alpha, beta] = fixture.agents;
        if (!(alpha?.dmChatId && beta)) {
            throw new Error('Inbox and attention needs two disposable Agents and an Owner DM.');
        }
        const productName = `inbox-product-${fixture.harness.stamp.slice(-8)}`;
        const product = await fixture.harness.trpc('chat.createChannel', {
            agentIds: [alpha.id, beta.id],
            name: productName,
            serverId: fixture.harness.serverId,
        });
        fixture.trackChat(product.id);

        return {
            ...fixture,
            all: fixture.channel,
            allName: fixture.channelName,
            alpha,
            beta,
            dm: alpha.dmChatId,
            product: product.id,
            productName,
            stamp: fixture.harness.stamp,
        };
    } catch (error) {
        await fixture.cleanup();
        throw error;
    }
}

function cleanReplies(replies: string[]) {
    return replies.map((reply) => reply.trim());
}
