import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
    type CloudAgentBranch,
    type CloudAgentWork,
    computerBootstrapProtocolVersion,
    computerProtocolVersion,
} from '@grotto/api';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let peer: GrottoClient;
let outsider: GrottoClient;

let serverId: string;
let channelId: string;
let orbitAgentId: string;
let ownerUserId: string;
let peerUserId: string;

const computerId = `cmp_${'c'.repeat(16)}`;
const credential = `cloud-agent-computer-credential-${'x'.repeat(16)}`;
const credentialHash = createHash('sha256').update(credential).digest('hex');

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = await signIn('user_cloud_owner', ['ada@grotto.test']);
    peer = await signIn('user_cloud_peer', ['bo@grotto.test']);
    outsider = await signIn('user_cloud_outsider', ['cass@grotto.test']);

    const server = await owner.trpc.server.create.mutate({
        displayName: 'Cloud HQ',
        slug: 'cloud-hq',
    });
    serverId = server.id;
    await owner.trpc.member.updateProfile.mutate({
        description: null,
        displayName: 'Ada',
        handle: 'ada',
        serverId,
    });
    await join(peer, 'bo@grotto.test', 'Bo', 'bo');
    await join(outsider, 'cass@grotto.test', 'Cass', 'cass');
    ownerUserId = await readUserId('user_cloud_owner');
    peerUserId = await readUserId('user_cloud_peer');

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
    orbitAgentId = (
        await owner.trpc.agent.create.mutate({
            computerId,
            displayName: 'Orbit',
            handle: 'orbit',
            modelId: 'gpt-5.6-sol',
            role: 'member',
            runtimeId: 'codex',
            serverId,
        })
    ).agent.id;
    channelId = (
        await owner.trpc.chat.createChannel.mutate({
            agentIds: [orbitAgentId],
            name: 'product',
            serverId,
        })
    ).id;
    await harness.sql`
        insert into channel_participants (server_id, chat_id, user_id)
        values (${serverId}, ${channelId}, ${peerUserId})
    `;
});

afterAll(async () => {
    owner.close();
    peer.close();
    outsider.close();
    await harness?.close();
});

test('one Cloud Agent work writes its Message, record, first Run, Thread, and events', async () => {
    const runner = await mintRunner('run_cloud_create');
    const head = await owner.trpc.chat.eventHead.query({ serverId });

    const created = await postStart(runner, startBody({ nonce: 'cloud-create' }));
    expect(created.status).toBe(200);
    const work = created.body.work as CloudAgentWork;
    expect(created.body).toMatchObject({
        chatId: channelId,
        idempotent: false,
        target: '#product',
        work: {
            agentId: orbitAgentId,
            cancelRequestedAt: null,
            chatId: channelId,
            computerId,
            provider: 'cursor',
            providerAgentId: null,
            repository: 'grotto/grotto',
            startingRef: 'main',
            status: 'queued',
            terminalAt: null,
            title: 'Fix the flaky delivery test',
        },
    });
    expect(work.runs).toHaveLength(1);
    expect(work.runs[0]).toMatchObject({ runId: created.body.runId, status: 'queued' });

    const threadChatId = `cht_thr_${(created.body.messageId as string).slice('msg_'.length)}`;
    const [thread] = (await harness.sql`
        select anchor_message_id, parent_chat_id from chats where id = ${threadChatId}
    `) as { anchor_message_id: string; parent_chat_id: string }[];
    expect(thread).toMatchObject({
        anchor_message_id: created.body.messageId,
        parent_chat_id: channelId,
    });

    const events = await owner.trpc.chat.events.query({ afterCursor: head.cursor, serverId });
    expect(events.map((event) => event.type)).toEqual([
        'message.created',
        'cloud-agent-work.updated',
    ]);
    expect(events[1]).toMatchObject({
        chatId: channelId,
        cloudAgentWorkId: work.id,
        messageId: created.body.messageId,
        type: 'cloud-agent-work.updated',
    });

    const replay = await postStart(runner, startBody({ nonce: 'cloud-create' }));
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ idempotent: true, work: { id: work.id } });
    expect(await countWork()).toBe(1);

    // The Message reads back to humans and Agents with its typed body.
    const history = await owner.trpc.chat.messages.query({ chatId: channelId, serverId });
    expect(history.messages.find((message) => message.id === created.body.messageId)).toMatchObject(
        {
            body: { kind: 'cloud-agent-work', work: { id: work.id } },
            content: 'Handing the flaky delivery test to a cloud agent.',
        }
    );
});

test('a launch that fails validation creates nothing', async () => {
    const runner = await mintRunner('run_cloud_invalid');
    const before = await countWork();

    expect(
        (await postStart(runner, startBody({ nonce: 'bad-repo', repository: 'grotto' }))).status
    ).toBe(400);
    expect(
        (await postStart(runner, startBody({ nonce: 'bad-title', title: 'a'.repeat(121) }))).status
    ).toBe(400);
    expect((await postStart(runner, startBody({ nonce: 'bad-say', content: '' }))).status).toBe(
        400
    );
    const unknownTarget = await postStart(
        runner,
        startBody({ nonce: 'bad-target', target: '#nowhere' })
    );
    expect(unknownTarget.status).toBe(404);
    expect(unknownTarget.body.code).toBe('INVALID_TARGET');
    expect((await postStart(null, startBody({ nonce: 'no-runner' }))).status).toBe(401);

    // A different work under a used nonce is a conflict, not a second Message.
    expect(
        (await postStart(runner, startBody({ nonce: 'cloud-create', title: 'Something else' })))
            .status
    ).toBe(409);
    expect(await countWork()).toBe(before);
});

test('observations apply idempotently and a settled Run creates one inbox attention', async () => {
    const runner = await mintRunner('run_cloud_observe');
    const created = await postStart(runner, startBody({ nonce: 'cloud-observe' }));
    const work = created.body.work as CloudAgentWork;
    const runId = created.body.runId as string;

    const socket = await attachComputer();
    socket.send(
        JSON.stringify({
            observation: {
                observedAt: '2026-09-04T12:00:00.000Z',
                providerAgentId: 'bc_one',
                providerUrl: 'https://cursor.com/agents/bc_one',
                runId,
                status: 'running',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await waitForWorkStatus(work.id, 'running');
    expect(await readWork(work.id)).toMatchObject({
        provider_agent_id: 'bc_one',
        provider_url: 'https://cursor.com/agents/bc_one',
        terminal_at: null,
    });

    // A stale observation is a no-op.
    socket.send(
        JSON.stringify({
            observation: {
                activity: { at: '2026-09-04T11:00:00.000Z', summary: 'Older news.' },
                observedAt: '2026-09-04T11:59:00.000Z',
                runId,
                status: 'queued',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await Bun.sleep(150);
    expect(await readWork(work.id)).toMatchObject({ activity_summary: null, status: 'running' });

    // The Computer's own GitHub reading of the pull request the Run opened.
    socket.send(
        JSON.stringify({
            observation: {
                branches: [
                    {
                        branch: 'cloud/fix-flake',
                        pullRequest: {
                            additions: 34,
                            changedFiles: 1,
                            deletions: 0,
                            number: 12,
                            observedAt: '2026-09-04T12:04:00.000Z',
                            state: 'draft',
                        },
                        pullRequestUrl: 'https://github.com/grotto/grotto/pull/12',
                        repository: 'grotto/grotto',
                    },
                ],
                observedAt: '2026-09-04T12:04:00.000Z',
                runId,
                status: 'running',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await waitFor(async () => (await readBranches(runId))[0]?.pullRequest);

    socket.send(
        JSON.stringify({
            observation: {
                branches: [
                    {
                        branch: 'cloud/fix-flake',
                        pullRequestUrl: 'https://github.com/grotto/grotto/pull/12',
                        repository: 'grotto/grotto',
                    },
                ],
                observedAt: '2026-09-04T12:05:00.000Z',
                rawStatus: 'FINISHED',
                runId,
                status: 'completed',
                summary: 'Opened a pull request.',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await waitForWorkStatus(work.id, 'completed');
    expect(await readRun(runId)).toMatchObject({
        raw_status: 'FINISHED',
        status: 'completed',
        summary: 'Opened a pull request.',
    });
    // A terminal report that could not read GitHub keeps the snapshot already recorded.
    expect(await readBranches(runId)).toEqual([
        {
            branch: 'cloud/fix-flake',
            pullRequest: {
                additions: 34,
                changedFiles: 1,
                deletions: 0,
                number: 12,
                observedAt: '2026-09-04T12:04:00.000Z',
                state: 'draft',
            },
            pullRequestUrl: 'https://github.com/grotto/grotto/pull/12',
            repository: 'grotto/grotto',
        },
    ]);
    expect(await readAttentions(runId)).toHaveLength(1);

    // A later terminal report changes nothing and adds no second attention.
    socket.send(
        JSON.stringify({
            observation: {
                observedAt: '2026-09-04T12:09:00.000Z',
                runId,
                status: 'failed',
                summary: 'Late duplicate.',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await Bun.sleep(150);
    expect(await readWork(work.id)).toMatchObject({ status: 'completed' });
    expect(await readAttentions(runId)).toHaveLength(1);
    socket.close();
});

test('the delegating Agent and an Admin cancel; an ordinary Member cannot', async () => {
    const runner = await mintRunner('run_cloud_cancel');
    const agentCancelled = await postStart(runner, startBody({ nonce: 'cloud-cancel-agent' }));
    const agentWork = agentCancelled.body.work as CloudAgentWork;
    const byAgent = await postCancel(runner, agentWork.id);
    expect(byAgent.status).toBe(200);
    expect(await readWork(agentWork.id)).toMatchObject({
        cancel_requested_by_agent_id: orbitAgentId,
        cancel_requested_by_user_id: null,
        status: 'queued',
    });

    const humanCancelled = await postStart(runner, startBody({ nonce: 'cloud-cancel-human' }));
    const humanWork = humanCancelled.body.work as CloudAgentWork;
    await expect(
        peer.trpc.cloudAgentWork.cancel.mutate({ serverId, workId: humanWork.id })
    ).rejects.toThrow(/Owners and Admins/i);
    await expect(
        owner.trpc.cloudAgentWork.cancel.mutate({ serverId, workId: humanWork.id })
    ).resolves.toEqual({ cancelRequested: true });
    expect(await readWork(humanWork.id)).toMatchObject({
        cancel_requested_by_agent_id: null,
        cancel_requested_by_user_id: ownerUserId,
    });

    // Cancelling settled work is a conflict, not a silent no-op.
    const socket = await attachComputer();
    socket.send(
        JSON.stringify({
            observation: {
                observedAt: '2026-09-04T13:00:00.000Z',
                runId: humanCancelled.body.runId,
                status: 'cancelled',
                workId: humanWork.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await waitForWorkStatus(humanWork.id, 'cancelled');
    await expect(
        owner.trpc.cloudAgentWork.cancel.mutate({ serverId, workId: humanWork.id })
    ).rejects.toThrow(/already settled/i);
    expect((await postCancel(runner, humanWork.id)).status).toBe(409);
    socket.close();
});

test('listActive shows queued and running work to members with Chat access only', async () => {
    const runner = await mintRunner('run_cloud_list');
    const created = await postStart(runner, startBody({ nonce: 'cloud-list' }));
    const work = created.body.work as CloudAgentWork;

    const forOwner = (await owner.trpc.cloudAgentWork.listActive.query({ serverId })).find(
        (row) => row.work.id === work.id
    );
    expect(forOwner).toMatchObject({
        chatKind: 'channel',
        chatName: 'product',
        chatPeerUserId: null,
        conversationChatId: channelId,
        message: { author: { kind: 'agent' }, body: { kind: 'cloud-agent-work' } },
        threadAnchorMessage: null,
        threadChatId: `cht_thr_${(created.body.messageId as string).slice('msg_'.length)}`,
        work: { status: 'queued' },
    });
    await expect(outsider.trpc.cloudAgentWork.listActive.query({ serverId })).resolves.toEqual([]);

    const socket = await attachComputer();
    socket.send(
        JSON.stringify({
            observation: {
                observedAt: '2026-09-04T14:00:00.000Z',
                runId: created.body.runId,
                status: 'failed',
                summary: 'The provider refused the launch.',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await waitForWorkStatus(work.id, 'failed');
    expect(
        (await owner.trpc.cloudAgentWork.listActive.query({ serverId })).map((row) => row.work.id)
    ).not.toContain(work.id);
    socket.close();
});

test('reconnect hands the Computer every non-terminal work it still owns', async () => {
    const runner = await mintRunner('run_cloud_reconcile');
    const created = await postStart(runner, startBody({ nonce: 'cloud-reconcile' }));
    const work = created.body.work as CloudAgentWork;
    await postCancel(runner, work.id);

    const socket = new WebSocket(computerSocketUrl());
    await opened(socket);
    const frames: Array<{ type?: string; work?: unknown[] }> = [];
    socket.addEventListener('message', (event) => {
        frames.push(JSON.parse(String(event.data)));
    });
    socket.send(JSON.stringify(bootstrapFrame()));

    const reconcile = await waitFor(() =>
        frames.find((frame) => frame.type === 'cloud-agent-reconcile')
    );
    expect(reconcile.work).toContainEqual({
        cancelRequested: true,
        provider: 'cursor',
        providerAgentId: null,
        providerRunId: null,
        runId: created.body.runId,
        status: 'queued',
        workId: work.id,
    });
    socket.close();
});

function startBody(overrides: Record<string, string> = {}) {
    return {
        content: 'Handing the flaky delivery test to a cloud agent.',
        nonce: 'cloud-default',
        provider: 'cursor',
        repository: 'grotto/grotto',
        startingRef: 'main',
        target: '#product',
        title: 'Fix the flaky delivery test',
        ...overrides,
    };
}

async function postStart(runner: { token: string } | null, body: Record<string, string>) {
    const response = await fetch(new URL('/api/agent/cloud-agents', harness.url), {
        body: JSON.stringify(body),
        headers: {
            ...(runner ? { authorization: `Bearer ${runner.token}` } : {}),
            'content-type': 'application/json',
        },
        method: 'POST',
    });
    return {
        body: (await response.json()) as {
            chatId?: string;
            code?: string;
            idempotent?: boolean;
            messageId?: string;
            runId?: string;
            target?: string;
            work?: CloudAgentWork;
        },
        status: response.status,
    };
}

async function postCancel(runner: { token: string }, workId: string) {
    const response = await fetch(new URL('/api/agent/cloud-agents/cancel', harness.url), {
        body: JSON.stringify({ workId }),
        headers: { authorization: `Bearer ${runner.token}`, 'content-type': 'application/json' },
        method: 'POST',
    });
    return { body: await response.json(), status: response.status };
}

async function mintRunner(runId: string) {
    const response = await fetch(new URL('/computer/runner/mint', harness.url), {
        body: JSON.stringify({ agentId: orbitAgentId, chatId: channelId, credentialHash, runId }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    expect(response.status).toBe(200);
    const { runnerToken } = (await response.json()) as { runnerToken: string };
    return { runId, token: runnerToken };
}

async function readWork(workId: string) {
    const [row] = (await harness.sql`
        select activity_summary, cancel_requested_by_agent_id, cancel_requested_by_user_id,
               provider_agent_id, provider_url, status, terminal_at
        from cloud_agent_work where id = ${workId}
    `) as Record<string, unknown>[];
    return row;
}

async function readRun(runId: string) {
    const [row] = (await harness.sql`
        select branches, raw_status, status, summary, terminal_at
        from cloud_agent_runs where id = ${runId}
    `) as Record<string, unknown>[];
    return row;
}

async function readBranches(runId: string): Promise<CloudAgentBranch[]> {
    return ((await readRun(runId))?.branches as CloudAgentBranch[] | undefined) ?? [];
}

async function readAttentions(runId: string) {
    return (await harness.sql`
        select id from agent_inbox
        where server_id = ${serverId} and source = 'cloud_agent_work' and dedupe_key = ${runId}
    `) as { id: string }[];
}

async function countWork() {
    const [row] = (await harness.sql`
        select count(*)::int as total from cloud_agent_work where server_id = ${serverId}
    `) as { total: number }[];
    return row.total;
}

async function waitForWorkStatus(workId: string, status: string) {
    await waitFor(async () => {
        const row = await readWork(workId);
        return row?.status === status ? row : null;
    });
}

async function waitFor<T>(read: () => Promise<T | null | undefined> | T | null | undefined) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        const value = await read();
        if (value) {
            return value;
        }
        await Bun.sleep(20);
    }
    throw new Error('Timed out waiting for the expected Cloud Agent state.');
}

async function attachComputer() {
    const socket = new WebSocket(computerSocketUrl());
    await opened(socket);
    socket.send(JSON.stringify(bootstrapFrame()));
    await new Promise<void>((resolve) => {
        socket.addEventListener(
            'message',
            (event) => {
                if (JSON.parse(String(event.data)).type === 'bootstrap-accepted') {
                    resolve();
                }
            },
            { once: true }
        );
    });
    return socket;
}

function bootstrapFrame() {
    return {
        architecture: 'arm64',
        bootstrapProtocolVersion: computerBootstrapProtocolVersion,
        credential,
        health: 'healthy',
        operatingSystem: 'darwin',
        productVersion: '1.1.2',
        protocolVersion: computerProtocolVersion,
        type: 'bootstrap',
        update: {
            detail: 'Grotto Computer updated successfully.',
            phase: 'complete',
            targetVersion: '1.1.2',
            updatedAt: '2026-07-29T16:53:27.328Z',
        },
    };
}

function computerSocketUrl() {
    const url = new URL('/computer/attachment', harness.url);
    url.protocol = 'ws:';
    return url;
}

function opened(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve(), { once: true });
        socket.addEventListener('error', () => reject(new Error('socket failed')), { once: true });
    });
}

async function join(client: GrottoClient, email: string, displayName: string, handle: string) {
    const { token } = await owner.trpc.invitation.create.mutate({ email, serverId });
    await client.trpc.invitation.accept.mutate({ token });
    await client.trpc.member.updateProfile.mutate({
        description: null,
        displayName,
        handle,
        serverId,
    });
}

async function signIn(clerkUserId: string, verifiedEmails: string[]) {
    harness.clerkUsers.setVerifiedEmails(clerkUserId, verifiedEmails);
    return createGrottoClient(harness, await harness.clerk.mintSessionToken(clerkUserId));
}

async function readUserId(clerkUserId: string) {
    const [row] = (await harness.sql`
        select id from users where clerk_user_id = ${clerkUserId}
    `) as { id: string }[];
    return row?.id ?? '';
}
