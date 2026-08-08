import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { computerBootstrapProtocolVersion, computerProtocolVersion } from '@tavern/api';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
const credential = 'onboarding-computer-credential-0000000000';

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = createGrottoClient(
        harness,
        await harness.clerk.mintSessionToken('user_onboarding_owner')
    );
});

afterAll(async () => {
    owner.close();
    await harness.close();
});

test('Computer reports advance durable onboarding only after usable inventory', async () => {
    const created = await owner.trpc.server.create.mutate({
        displayName: 'Onboarding HQ',
        slug: 'onboarding-hq',
    });
    const setup = await createComputerAttachment();
    const socket = await connectComputer();

    await expectOnboarding('awaiting-computer', {
        computerId: setup.computerId,
        failure: null,
    });

    socket.send(JSON.stringify({ inventory: { runtimes: [] }, type: 'report' }));
    await expectOnboarding('awaiting-computer', {
        failure: {
            code: 'inventory-empty',
            detail: 'This Computer did not report a usable runtime and model.',
        },
    });

    socket.send(
        JSON.stringify({
            inventory: {
                runtimes: [
                    {
                        id: 'codex',
                        label: 'Codex',
                        models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
                    },
                ],
            },
            type: 'report',
        })
    );
    await expectOnboarding('awaiting-cove', {
        computerId: setup.computerId,
        failure: null,
    });

    const otherCredential = 'other-onboarding-computer-credential-00000';
    await createComputerAttachment(created.slug, otherCredential);
    const otherSocket = await connectComputer(otherCredential);
    otherSocket.send(
        JSON.stringify({
            inventory: {
                runtimes: [
                    {
                        id: 'other',
                        label: 'Other',
                        models: [{ id: 'other-model', label: 'Other model' }],
                    },
                ],
            },
            type: 'report',
        })
    );
    await Bun.sleep(50);
    await expectOnboarding('awaiting-cove', {
        computerId: setup.computerId,
        failure: null,
    });
    otherSocket.close();

    const token = owner.clerkSessionToken;
    await harness.restart();
    owner.close();
    owner = createGrottoClient(harness, token);
    await expectOnboarding('awaiting-cove', {
        failure: {
            code: 'computer-disconnected',
            detail: 'The Computer disconnected. Run setup again on that Computer.',
        },
    });

    socket.close();
    const reconnected = await connectComputer();
    await expectOnboarding('awaiting-cove', { failure: null });
    reconnected.close();

    async function expectOnboarding(
        phase: 'awaiting-computer' | 'awaiting-cove',
        expected: { computerId?: string; failure: unknown }
    ) {
        expect(await waitForOnboarding(created.slug, { phase, ...expected })).toMatchObject({
            phase,
            ...expected,
        });
    }
});

test('incompatible and invalid Computer reports stay actionable', async () => {
    const created = await owner.trpc.server.create.mutate({
        displayName: 'Repair HQ',
        slug: 'repair-hq',
    });
    const repairCredential = 'repair-computer-credential-00000000000000';
    const setup = await createComputerAttachment('repair-hq', repairCredential);
    const socket = await connectComputer(repairCredential, computerProtocolVersion - 1);

    expect(
        await waitForOnboarding(created.slug, {
            computerId: setup.computerId,
            failure: {
                code: 'computer-incompatible',
                detail: 'Update Grotto Computer before continuing setup.',
            },
            phase: 'awaiting-computer',
        })
    ).toMatchObject({
        computerId: setup.computerId,
        failure: {
            code: 'computer-incompatible',
            detail: 'Update Grotto Computer before continuing setup.',
        },
        phase: 'awaiting-computer',
    });
    socket.close();
    await Bun.sleep(50);

    const repaired = await connectComputer(repairCredential);
    repaired.send(
        JSON.stringify({ inventory: { runtimes: [{ id: '', models: [] }] }, type: 'report' })
    );
    expect(
        await waitForOnboarding(created.slug, {
            failure: {
                code: 'inventory-invalid',
                detail: 'The Computer reported invalid inventory. Update it and reconnect.',
            },
        })
    ).toMatchObject({
        failure: {
            code: 'inventory-invalid',
            detail: 'The Computer reported invalid inventory. Update it and reconnect.',
        },
        phase: 'awaiting-computer',
    });
    repaired.close();
});

test('creates and applies one immutable Cove through a replayable Computer operation', async () => {
    const created = await owner.trpc.server.create.mutate({
        displayName: 'Cove HQ',
        slug: 'cove-hq',
    });
    const coveCredential = 'cove-computer-credential-000000000000000';
    const setup = await createComputerAttachment(created.slug, coveCredential);
    let socket = await connectComputer(coveCredential);
    socket.send(
        JSON.stringify({
            inventory: {
                runtimes: [
                    {
                        id: 'codex',
                        label: 'Codex',
                        models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
                    },
                ],
            },
            type: 'report',
        })
    );
    await waitForOnboarding(created.slug, { phase: 'awaiting-cove' });

    const firstApplication = nextSocketFrame(socket, 'cove-apply');
    const first = await owner.trpc.server.createCove.mutate({
        computerId: setup.computerId,
        modelId: 'gpt-5.6-sol',
        runtimeId: 'codex',
        serverId: created.id,
    });
    expect(first).toMatchObject({
        agent: {
            computerId: setup.computerId,
            description: 'Onboarding Assistant',
            displayName: 'Cove',
            handle: 'cove',
            role: 'admin',
        },
        channelId: created.onboarding.channelId,
        phase: 'applying',
    });

    const command = await firstApplication;
    expect(command).toMatchObject({
        agentId: first.agent.id,
        applicationId: first.applicationId,
        factoryKind: 'cove',
        type: 'cove-apply',
    });

    socket.send(
        JSON.stringify({
            agentId: first.agent.id,
            applicationId: first.applicationId,
            error: 'Workspace application failed.',
            factoryKind: 'cove',
            status: 'failed',
            type: 'cove-apply-result',
        })
    );
    await waitForOnboarding(created.slug, {
        failure: { code: 'application-failed', detail: 'Workspace application failed.' },
    });
    socket.send(
        JSON.stringify({
            inventory: {
                runtimes: [
                    {
                        id: 'codex',
                        label: 'Codex',
                        models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
                    },
                ],
            },
            type: 'report',
        })
    );
    expect(
        await waitForOnboarding(created.slug, {
            failure: { code: 'application-failed', detail: 'Workspace application failed.' },
        })
    ).toMatchObject({ phase: 'applying' });

    socket.close();
    await Bun.sleep(50);
    const replayFrames: Record<string, unknown>[] = [];
    socket = await connectComputer(coveCredential, computerProtocolVersion, replayFrames);
    await waitForFrame(replayFrames, 'cove-apply');
    expect(replayFrames.filter((frame) => frame.type === 'cove-apply')).toHaveLength(1);
    expect(replayFrames.some((frame) => frame.type === 'agent-configure')).toBe(false);
    expect(replayFrames.some((frame) => frame.type === 'start')).toBe(false);
    await expect(
        owner.trpc.agent.configure.mutate({
            agentId: first.agent.id,
            modelId: 'gpt-5.6-sol',
            runtimeId: 'codex',
            serverId: created.id,
        })
    ).rejects.toThrow(/setup must finish/u);
    expect(replayFrames.some((frame) => frame.type === 'agent-configure')).toBe(false);

    const retry = await owner.trpc.server.createCove.mutate({
        computerId: setup.computerId,
        modelId: 'gpt-5.6-sol',
        runtimeId: 'codex',
        serverId: created.id,
    });
    expect(retry).toEqual(first);
    const concurrent = await Promise.all([
        owner.trpc.server.createCove.mutate({
            computerId: setup.computerId,
            modelId: 'gpt-5.6-sol',
            runtimeId: 'codex',
            serverId: created.id,
        }),
        owner.trpc.server.createCove.mutate({
            computerId: setup.computerId,
            modelId: 'gpt-5.6-sol',
            runtimeId: 'codex',
            serverId: created.id,
        }),
    ]);
    expect(concurrent).toEqual([first, first]);
    await expect(
        owner.trpc.server.createCove.mutate({
            computerId: setup.computerId,
            modelId: 'different-model',
            runtimeId: 'codex',
            serverId: created.id,
        })
    ).rejects.toThrow(/configuration is already locked/i);

    socket.send(
        JSON.stringify({
            agentId: first.agent.id,
            applicationId: first.applicationId,
            factoryKind: 'cove',
            status: 'applied',
            type: 'cove-apply-result',
        })
    );
    const completed = await waitForOnboarding(created.slug, { phase: 'complete' });
    expect(completed).toMatchObject({
        agentId: first.agent.id,
        applicationId: first.applicationId,
        channelId: created.onboarding.channelId,
        failure: null,
    });

    const [agentRow] = await harness.sql`
        select a.handle, a.display_name, a.description, a.role, a.computer_id,
               a.desired_runtime_id, a.desired_model_id, a.factory_kind,
               av.sha256, av.bytes
        from agents a
        join avatars av on av.id = a.avatar_id
        where a.server_id = ${created.id}
    `;
    expect(agentRow).toMatchObject({
        computer_id: setup.computerId,
        description: 'Onboarding Assistant',
        desired_model_id: 'gpt-5.6-sol',
        desired_runtime_id: 'codex',
        display_name: 'Cove',
        factory_kind: 'cove',
        handle: 'cove',
        role: 'admin',
        sha256: 'c4940cf58f438175d5c781e513471f70865eaa803301013f7526e557ada29391',
    });
    expect(Buffer.from(agentRow?.bytes as Uint8Array).byteLength).toBe(1_337_637);

    const [participant] = await harness.sql`
        select agent_id from channel_agent_participants
        where server_id = ${created.id} and chat_id = ${created.onboarding.channelId}
    `;
    expect(participant?.agent_id).toBe(first.agent.id);
    await expect(
        owner.trpc.agent.updateProfile.mutate({
            agentId: first.agent.id,
            description: 'Changed',
            displayName: 'Changed',
            serverId: created.id,
        })
    ).rejects.toThrow(/product-owned identity/u);
    await expect(
        owner.trpc.avatar.clear.mutate({
            serverId: created.id,
            target: { agentId: first.agent.id, kind: 'agent' },
        })
    ).rejects.toThrow(/product-owned avatar/u);
    await expect(
        owner.trpc.agent.reset.mutate({
            agentId: first.agent.id,
            kind: 'full',
            serverId: created.id,
        })
    ).rejects.toThrow(/reset is not available/u);
    await expect(
        owner.trpc.agent.delete.mutate({
            agentId: first.agent.id,
            confirmation: 'Cove',
            serverId: created.id,
        })
    ).rejects.toThrow(/deletion is not available/u);

    socket.close();
});

async function createComputerAttachment(slug = 'onboarding-hq', secret = credential) {
    const computer = createGrottoClient(harness);
    const setup = await computer.trpc.computer.begin.mutate({
        credentialHash: createHash('sha256').update(secret).digest('hex'),
        slug,
    });
    const approvalUrl = new URL(setup.approvalUrl);
    const approvalId = approvalUrl.searchParams.get('approval');
    const approvalSecret = approvalUrl.searchParams.get('secret');
    if (!(approvalId && approvalSecret)) {
        throw new Error('Computer approval URL did not contain its credentials.');
    }
    const approved = await owner.trpc.computer.approve.mutate({
        approvalId,
        secret: approvalSecret,
    });
    computer.close();
    return approved;
}

async function connectComputer(
    secret = credential,
    protocolVersion = computerProtocolVersion,
    frames?: Record<string, unknown>[]
) {
    const url = new URL('/computer/attachment', harness.url);
    url.protocol = 'ws:';
    const socket = new WebSocket(url);
    if (frames) {
        socket.addEventListener('message', (event) => {
            frames.push(JSON.parse(String(event.data)) as Record<string, unknown>);
        });
    }
    await new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve(), { once: true });
        socket.addEventListener('error', () => reject(new Error('Computer socket failed.')), {
            once: true,
        });
    });
    socket.send(
        JSON.stringify({
            architecture: 'arm64',
            bootstrapProtocolVersion: computerBootstrapProtocolVersion,
            credential: secret,
            health: 'healthy',
            operatingSystem: 'darwin',
            productVersion: '1.0.0',
            protocolVersion,
            type: 'bootstrap',
            update: {
                detail: null,
                phase: 'idle',
                targetVersion: null,
                updatedAt: new Date().toISOString(),
            },
        })
    );
    await new Promise<void>((resolve, reject) => {
        socket.addEventListener('message', () => resolve(), { once: true });
        socket.addEventListener(
            'close',
            (event) => reject(new Error(`Computer socket closed ${event.code}: ${event.reason}`)),
            { once: true }
        );
    });
    return socket;
}

async function waitForFrame(frames: Record<string, unknown>[], type: string) {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && !frames.some((frame) => frame.type === type)) {
        await Bun.sleep(10);
    }
}

async function waitForOnboarding(slug: string, expected: Record<string, unknown>) {
    const deadline = Date.now() + 3000;
    let onboarding = (await owner.trpc.server.bySlug.query({ slug })).onboarding;
    while (Date.now() < deadline) {
        const matches = Object.entries(expected).every(
            ([key, value]) =>
                JSON.stringify(onboarding[key as keyof typeof onboarding]) === JSON.stringify(value)
        );
        if (matches) {
            return onboarding;
        }
        await Bun.sleep(25);
        onboarding = (await owner.trpc.server.bySlug.query({ slug })).onboarding;
    }
    return onboarding;
}

async function nextSocketFrame(socket: WebSocket, type: string) {
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`No ${type} frame arrived.`)), 3000);
        socket.addEventListener('message', function onMessage(event) {
            const frame = JSON.parse(String(event.data)) as Record<string, unknown>;
            if (frame.type !== type) {
                return;
            }
            clearTimeout(timeout);
            socket.removeEventListener('message', onMessage);
            resolve(frame);
        });
    });
}
