import { afterEach, expect, test } from 'bun:test';
import type { CloudAgentObservation } from '@grotto/api';
import { createFakeCloudAgentProvider } from './fake-provider.ts';
import { CloudAgentProviderUnavailableError } from './provider.ts';
import { setCloudAgentProvider } from './registry.ts';
import {
    applyCloudAgentCancel,
    CloudAgentLaunchFailedError,
    reconcileCloudAgentWork,
    setCloudAgentReporter,
    startCloudAgentWork,
} from './work-runner.ts';

const serverId = 'srv_cloud';
const serverOrigin = 'https://grotto.test';
const workId = 'caw_1234567890abcdef';
const runId = 'car_1234567890abcdef';

const request = {
    content: 'Handing this to a cloud agent.',
    instructions: 'Reproduce the flake and open a pull request.',
    nonce: 'cloud-agent-nonce',
    repository: 'grotto/grotto',
    startingRef: 'main',
    target: '#product',
    title: 'Fix the flaky delivery test',
};

const receipt = {
    chatId: 'cht_product',
    idempotent: false,
    messageId: 'msg_1a2b3c4d5e6f7890',
    runId,
    sequence: 7,
    target: '#product',
    work: {
        activity: null,
        agentId: 'agt_orbit',
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        chatId: 'cht_product',
        computerId: 'cmp_studio',
        createdAt: '2026-09-04T12:00:00.000Z',
        id: workId,
        messageId: 'msg_1a2b3c4d5e6f7890',
        provider: 'cursor',
        providerAgentId: null,
        providerUrl: null,
        repository: 'grotto/grotto',
        runs: [],
        startedAt: null,
        startingRef: 'main',
        status: 'queued',
        terminalAt: null,
        title: 'Fix the flaky delivery test',
        updatedAt: '2026-09-04T12:00:00.000Z',
    },
};

const restores: Array<() => void> = [];

afterEach(() => {
    setCloudAgentReporter(serverId, null);
    while (restores.length > 0) {
        restores.pop()?.();
    }
});

function install(provider: ReturnType<typeof createFakeCloudAgentProvider>) {
    restores.push(setCloudAgentProvider(provider));
    return provider;
}

function collect(): CloudAgentObservation[] {
    const observations: CloudAgentObservation[] = [];
    setCloudAgentReporter(serverId, (observation) => observations.push(observation));
    return observations;
}

function stubServer(body: unknown = receipt, status = 200) {
    const calls: Array<{ body: unknown; url: string }> = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((url: URL | string, init?: RequestInit) => {
        calls.push({ body: JSON.parse(String(init?.body ?? '{}')), url: String(url) });
        return Promise.resolve(Response.json(body, { status }));
    }) as typeof fetch;
    restores.push(() => {
        globalThis.fetch = original;
    });
    return calls;
}

test('an unavailable provider fails before the Server is asked for anything', async () => {
    install(
        createFakeCloudAgentProvider({
            readiness: { ready: false, reason: 'provider-unavailable' },
        })
    );
    const calls = stubServer();

    await expect(
        startCloudAgentWork({ request, runnerToken: 'grtr_x', serverId, serverOrigin })
    ).rejects.toThrow(CloudAgentProviderUnavailableError);
    expect(calls).toHaveLength(0);
});

test('a launch records the work, keeps instructions local, and reports the provider ids', async () => {
    const provider = install(createFakeCloudAgentProvider());
    const calls = stubServer();
    const observations = collect();

    const result = await startCloudAgentWork({
        request,
        runnerToken: 'grtr_x',
        serverId,
        serverOrigin,
    });

    expect(result.work.id).toBe(workId);
    expect(calls[0]?.url).toBe('https://grotto.test/api/agent/cloud-agents');
    expect(calls[0]?.body).toEqual({
        content: request.content,
        nonce: request.nonce,
        provider: 'cursor',
        repository: request.repository,
        startingRef: 'main',
        target: '#product',
        title: request.title,
    });
    // The provider prompt reaches the provider and nothing else.
    expect(provider.launches[0]).toMatchObject({
        idempotencyKey: runId,
        instructions: request.instructions,
        ref: 'main',
        repository: 'grotto/grotto',
    });
    expect(observations).toEqual([
        {
            observedAt: expect.any(String),
            providerAgentId: `bc_${runId}`,
            providerRunId: `run_${runId}`,
            providerUrl: `https://cursor.com/agents/bc_${runId}`,
            runId,
            status: 'running',
            workId,
        },
    ]);
});

test('live provider events ride the subscription until the Run settles', async () => {
    const provider = install(
        createFakeCloudAgentProvider({
            transitions: [
                {
                    activity: { at: '2026-09-04T12:01:00.000Z', summary: 'Reading the test.' },
                    observedAt: '2026-09-04T12:01:00.000Z',
                    status: 'running',
                },
                {
                    observedAt: '2026-09-04T12:05:00.000Z',
                    status: 'completed',
                    summary: 'Opened a pull request.',
                },
                { observedAt: '2026-09-04T12:09:00.000Z', status: 'failed' },
            ],
        })
    );
    stubServer();
    const observations = collect();

    await startCloudAgentWork({ request, runnerToken: 'grtr_x', serverId, serverOrigin });
    provider.advance();
    provider.advance();
    provider.advance();

    expect(observations.map((observation) => observation.status)).toEqual([
        'running',
        'running',
        'completed',
    ]);
    expect(observations.at(-1)).toMatchObject({ runId, summary: 'Opened a pull request.', workId });
});

test('a provider that refuses the launch settles the recorded work as failed', async () => {
    const provider = install(createFakeCloudAgentProvider());
    provider.failNextStart('Repository access is missing.');
    stubServer();
    const observations = collect();

    await expect(
        startCloudAgentWork({ request, runnerToken: 'grtr_x', serverId, serverOrigin })
    ).rejects.toThrow(CloudAgentLaunchFailedError);
    expect(observations[0]).toMatchObject({
        errorCode: 'provider-launch-failed',
        runId,
        status: 'failed',
        summary: 'Repository access is missing.',
        workId,
    });
});

test('a Server refusal reaches the caller and reports nothing', async () => {
    install(createFakeCloudAgentProvider());
    stubServer({ code: 'TARGET_READ_ONLY', message: 'That channel is archived.' }, 409);
    const observations = collect();

    await expect(
        startCloudAgentWork({ request, runnerToken: 'grtr_x', serverId, serverOrigin })
    ).rejects.toThrow(/archived/);
    expect(observations).toHaveLength(0);
});

test('a Server-recorded cancel stops the provider and reports the settled Run', async () => {
    install(createFakeCloudAgentProvider());
    const observations = collect();

    await applyCloudAgentCancel(serverId, {
        provider: 'cursor',
        providerAgentId: 'bc_one',
        providerRunId: 'run_one',
        runId,
        type: 'cloud-agent-cancel',
        workId,
    });

    expect(observations[0]).toMatchObject({ runId, status: 'cancelled', workId });
});

test('reconnect reconciliation reads every non-terminal Run and applies pending cancels', async () => {
    install(
        createFakeCloudAgentProvider({
            transitions: [{ observedAt: '2026-09-04T12:05:00.000Z', status: 'completed' }],
        })
    );
    const observations = collect();

    await reconcileCloudAgentWork(serverId, [
        {
            cancelRequested: false,
            provider: 'cursor',
            providerAgentId: 'bc_one',
            providerRunId: 'run_one',
            runId,
            status: 'running',
            workId,
        },
        {
            cancelRequested: true,
            provider: 'cursor',
            providerAgentId: 'bc_two',
            providerRunId: 'run_two',
            runId: 'car_abcdef1234567890',
            status: 'queued',
            workId: 'caw_abcdef1234567890',
        },
    ]);

    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({ runId, workId });
    expect(observations[1]).toMatchObject({
        runId: 'car_abcdef1234567890',
        status: 'cancelled',
        workId: 'caw_abcdef1234567890',
    });
});

test('a provider that cannot be read leaves the work alone for the next reconnect', async () => {
    const provider = install(createFakeCloudAgentProvider());
    provider.read = () => Promise.reject(new Error('The provider is unreachable.'));
    const observations = collect();

    await reconcileCloudAgentWork(serverId, [
        {
            cancelRequested: false,
            provider: 'cursor',
            providerAgentId: null,
            providerRunId: null,
            runId,
            status: 'queued',
            workId,
        },
    ]);

    // Settling live provider work on a transient read failure would be a lie.
    expect(observations).toHaveLength(0);
});

test('a replayed nonce reconciles the recorded Run instead of launching a second one', async () => {
    const provider = install(createFakeCloudAgentProvider());
    stubServer({ ...receipt, idempotent: true });
    const observations = collect();

    const result = await startCloudAgentWork({
        request,
        runnerToken: 'grtr_x',
        serverId,
        serverOrigin,
    });

    expect(result.idempotent).toBe(true);
    expect(provider.launches).toHaveLength(0);
    expect(observations[0]).toMatchObject({ runId, workId });
});
