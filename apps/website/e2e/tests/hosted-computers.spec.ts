import { createHash } from 'node:crypto';
import { createTRPCClient, httpLink } from '@trpc/client';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { readClerkSessionFixture, signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

test('an Owner updates one Computer from Settings through isolated progress', async ({ page }) => {
    await signInAsClerkHuman(page);
    await page.goto('/s');
    await page.getByLabel('Name').fill('Computer HQ');
    await page.getByLabel('Address').fill('computer-hq');
    await page.getByRole('button', { name: 'Create Server' }).click();

    const session = readClerkSessionFixture();
    const owner = hostedClient(session.token);
    const credential = 'computer-test-credential-1234567890';
    const setup = await owner.computer.begin.mutate({
        credentialHash: createHash('sha256').update(credential).digest('hex'),
        slug: 'computer-hq',
    });
    await page.goto(setup.approvalUrl);
    await page.getByRole('button', { name: 'Approve Computer' }).click();
    await expect(page.getByText('Approved. Return to Grotto Computer.')).toBeVisible();

    await page.goto('/s/computer-hq/computers');
    await expect(page.getByRole('heading', { name: 'Computers' })).toBeVisible();
    await expect(page.getByText('Awaiting connection · —')).toBeVisible();
    await expect(page.getByText('offline')).toBeVisible();

    const computer = new WebSocket(
        `ws://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/attachment`
    );
    await socketOpen(computer);
    const bootstrapAccepted = socketMessage(computer);
    computer.send(
        JSON.stringify({
            architecture: 'arm64',
            bootstrapProtocolVersion: 1,
            credential,
            health: 'healthy',
            operatingSystem: 'darwin',
            productVersion: '1.0.0',
            protocolVersion: 999,
            type: 'bootstrap',
            update: {
                detail: null,
                phase: 'idle',
                targetVersion: null,
                updatedAt: new Date().toISOString(),
            },
        })
    );
    expect(await bootstrapAccepted).toMatchObject({
        mode: 'update-required',
        type: 'bootstrap-accepted',
    });

    await page.reload();
    await expect(page.getByText('v1.0.0 · protocol 999')).toBeVisible();
    await expect(page.getByText(/Ordinary controls are paused/u)).toBeVisible();

    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Checking production release…')).toBeVisible();
    await expect(page.getByText('Update available')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update' })).toBeEnabled();

    const updateCommand = socketMessage(computer);
    await page.getByRole('button', { name: 'Update' }).click();
    expect(await updateCommand).toMatchObject({
        release: { release: { version: '1.1.0' } },
        type: 'update',
    });
    await reportProgress(computer, 'installing', 'Installing signed release.');
    await expect(page.getByText('Installing signed release…')).toBeVisible();
    await reportProgress(computer, 'waiting-for-agents', 'Waiting for active Agents.');
    await expect(page.getByText('Waiting for active Agents…')).toBeVisible();
    await reportProgress(computer, 'restarting', 'Restarting Computer.');
    await expect(page.getByText('Restarting Computer…')).toBeVisible();
    await reportProgress(computer, 'complete', 'Grotto Computer updated successfully.');
    await expect(page.getByText('Update complete')).toBeVisible();
    computer.close();

    await expect(
        owner.computer.approve.mutate({
            approvalId: new URL(setup.approvalUrl).searchParams.get('approval') ?? '',
            secret: new URL(setup.approvalUrl).searchParams.get('secret') ?? '',
        })
    ).rejects.toThrow(/already used/iu);
});

function socketOpen(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve(), { once: true });
        socket.addEventListener('error', () => reject(new Error('Computer socket failed.')), {
            once: true,
        });
    });
}

function socketMessage(socket: WebSocket) {
    return new Promise<unknown>((resolve) => {
        socket.addEventListener('message', (event) => resolve(JSON.parse(String(event.data))), {
            once: true,
        });
    });
}

async function reportProgress(
    socket: WebSocket,
    phase: 'complete' | 'installing' | 'restarting' | 'waiting-for-agents',
    detail: string
) {
    socket.send(
        JSON.stringify({
            type: 'update-progress',
            update: {
                detail,
                phase,
                targetVersion: '1.1.0',
                updatedAt: new Date().toISOString(),
            },
        })
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
}

function hostedClient(token: string) {
    return createTRPCClient<GrottoRouter>({
        links: [
            httpLink({
                headers: { authorization: `Bearer ${token}` },
                url: `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/trpc`,
            }),
        ],
    });
}
