import { afterAll, beforeAll, expect, test } from 'bun:test';
import { recordExactMessagesServed } from '../src/agent-delivery/cursors.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let database: GrottoConnection;
let agentId: string;
let chatId: string;
let serverId: string;

const computerId = `cmp_${'a'.repeat(16)}`;
const credentialHash = 'a'.repeat(64);
const png = Uint8Array.from(
    Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
    )
);

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    database = await connectGrottoDatabase(harness.databaseUrl);
    owner = await signIn('user_action_api_owner');
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Action API HQ',
        slug: 'action-api-hq',
    });
    serverId = server.id;
    const ownerUserId = await readUserId('user_action_api_owner');
    await harness.sql`
        insert into computers (
            id, server_id, attached_by_user_id, credential_hash, reported_inventory, health
        )
        values (
            ${computerId}, ${serverId}, ${ownerUserId}, ${credentialHash},
            ${{ runtimes: [{ id: 'codex', label: 'Codex', models: [{ id: 'gpt-5.6-sol', label: 'Sol' }] }] }}::jsonb,
            'healthy'
        )
    `;
    const created = await owner.trpc.agent.create.mutate({
        computerId,
        displayName: 'Action Agent',
        handle: 'action-agent',
        modelId: 'gpt-5.6-sol',
        role: 'member',
        runtimeId: 'codex',
        serverId,
    });
    agentId = created.agent.id;
    chatId = created.chat.id;
    await owner.trpc.chat.send.mutate({
        chatId,
        content: 'Prepare an Agent proposal for the launch.',
        nonce: 'action-human-brief',
        serverId,
    });
});

afterAll(async () => {
    owner.close();
    await database.close();
    await harness.close();
});

test('prepares through the scoped API with durable media, replay, conflict, and freshness', async () => {
    const missingToken = await actionPost(null, actionBody('Orbit', 'action-first'));
    expect(missingToken.status).toBe(401);

    const runner = await mintRunner('run_action_api');
    const read = await agentGet(runner.runnerToken, { target: 'dm:@operator' });
    expect(read.status).toBe(200);
    await recordExactMessagesServed(database.db, {
        agentId,
        messages: (read.body.messages ?? []).map((message) => ({
            chatId: message.chat_id,
            id: message.id,
        })),
        runId: 'run_action_api',
        serverId,
    });

    const first = await actionPost(runner.runnerToken, actionBody('Orbit', 'action-first'));
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
        action: { kind: 'agent:create', proposal: { name: 'Orbit' }, status: 'pending' },
        chatId,
        idempotent: false,
        target: 'dm:@operator',
    });
    const firstId = first.body.action?.id as string;
    const firstMessageId = first.body.messageId as string;

    const page = await owner.trpc.chat.messages.query({ chatId, serverId });
    expect(page.messages.find((message) => message.id === firstMessageId)).toMatchObject({
        content: '',
        preparedAction: { id: firstId, status: 'pending' },
    });

    const mediaUrl = first.body.action?.proposal?.avatar?.url as string;
    const media = await fetch(new URL(mediaUrl, harness.url));
    expect(media.status).toBe(200);
    expect(media.headers.get('cache-control')).toContain('immutable');
    expect(media.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await media.arrayBuffer())).toEqual(png);

    const replay = await actionPost(runner.runnerToken, actionBody('Orbit', 'action-first'));
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ action: { id: firstId }, idempotent: true });

    const conflict = await actionPost(runner.runnerToken, actionBody('Different', 'action-first'));
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('ACTION_IDEMPOTENCY_CONFLICT');

    const second = await actionPost(
        runner.runnerToken,
        actionBody('Orbit Revised', 'action-second')
    );
    expect(second.status).toBe(200);
    expect(
        (await owner.trpc.chat.messages.query({ chatId, serverId })).messages.find(
            (message) => message.id === firstMessageId
        )?.preparedAction?.status
    ).toBe('superseded');

    await owner.trpc.chat.send.mutate({
        chatId,
        content: 'The human brief changed again.',
        nonce: 'action-human-change',
        serverId,
    });
    const stale = await actionPost(runner.runnerToken, actionBody('Too Late', 'action-stale'));
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: 'ACTION_VIEW_STALE' });
});

async function mintRunner(runId: string) {
    const response = await fetch(new URL('/computer/runner/mint', harness.url), {
        body: JSON.stringify({ agentId, chatId, credentialHash, runId }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    expect(response.status).toBe(200);
    return (await response.json()) as { runnerToken: string };
}

async function actionPost(token: string | null, body: Record<string, unknown>) {
    const response = await fetch(new URL('/api/agent/actions/prepare', harness.url), {
        body: JSON.stringify(body),
        headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            'content-type': 'application/json',
        },
        method: 'POST',
    });
    return {
        body: (await response.json()) as {
            action?: {
                id?: string;
                proposal?: {
                    avatar?: { url?: string };
                    name?: string;
                };
                status?: string;
            };
            chatId?: string;
            code?: string;
            idempotent?: boolean;
            messageId?: string;
            target?: string;
        },
        status: response.status,
    };
}

function actionBody(name: string, nonce: string) {
    return {
        action: { kind: 'agent:create', name },
        avatar: { bytesBase64: Buffer.from(png).toString('base64'), mediaType: 'image/png' },
        nonce,
        target: 'dm:@operator',
    };
}

async function agentGet(token: string, query: Record<string, string>) {
    const url = new URL('/api/agent/history', harness.url);
    for (const [name, value] of Object.entries(query)) {
        url.searchParams.set(name, value);
    }
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    return {
        body: (await response.json()) as {
            messages?: Array<{ chat_id: string; id: string; sequence: number }>;
        },
        status: response.status,
    };
}

async function signIn(clerkUserId: string) {
    return createGrottoClient(harness, await harness.clerk.mintSessionToken(clerkUserId));
}

async function readUserId(clerkUserId: string) {
    const rows = (await harness.sql`
        select id from users where clerk_user_id = ${clerkUserId}
    `) as { id: string }[];
    return rows[0]?.id ?? '';
}
