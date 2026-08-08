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

async function connectComputer(secret = credential, protocolVersion = computerProtocolVersion) {
    const url = new URL('/computer/attachment', harness.url);
    url.protocol = 'ws:';
    const socket = new WebSocket(url);
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
