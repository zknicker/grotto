import { computerProtocolVersion } from '@tavern/api';
import { attachComputer, createTestServer } from '../support/server.ts';
import { expect, test } from '../support/test.ts';

test('a populated Computer page never presents its attach flow while inventory loads', async ({
    page,
}) => {
    const { client: owner } = await createTestServer(page, {
        displayName: 'Loading Computer HQ',
        slug: 'loading-computer-hq',
    });
    await attachComputer(owner, {
        credential: 'computer-loading-test-credential-1234',
        slug: 'loading-computer-hq',
    });
    // Matches the batched form too: httpBatchLink joins concurrent procedures
    // into one `/trpc/a,b?batch=1` request, so the single-procedure path alone
    // would never intercept — and the skeletons would resolve unobserved.
    await page.route('**/trpc/*computer.list*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
    });

    await page.goto('/s/loading-computer-hq/computers');

    await expect(page.getByText('Loading Computers')).toHaveCount(2);
    await expect(page.getByText('Attach a Computer')).toHaveCount(0);
    await expect(page.getByText('Attached · 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Attach a Computer')).toHaveCount(0);
});

test('an Owner updates one Computer from Settings through isolated progress', async ({ page }) => {
    const { client: owner } = await createTestServer(page, {
        displayName: 'Computer HQ',
        slug: 'computer-hq',
    });
    const credential = 'computer-test-credential-1234567890';
    await attachComputer(owner, {
        credential,
        slug: 'computer-hq',
    });

    await page.goto('/s/computer-hq/computers');
    await expect(page.getByText('Attached · 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Awaiting first report')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recovery Commands' })).toBeVisible();

    const computer = new WebSocket(
        `ws://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/attachment`
    );
    await socketOpen(computer);
    const bootstrapAccepted = socketMessage(computer);
    sendBootstrap(computer, credential, 'idle');
    expect(await bootstrapAccepted).toMatchObject({
        mode: 'update-required',
        type: 'bootstrap-accepted',
    });

    await page.reload();
    const detail = page.getByRole('main', { name: 'Scrollable main content' });
    await expect(detail.getByText('v1.0.0', { exact: true })).toBeVisible();
    await expect(detail.getByText(/Ordinary controls are paused/u)).toBeVisible();

    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Checking production release…')).toBeVisible();
    await expect(page.getByText('Update available')).toBeVisible();
    await expect(page.getByRole('button', { exact: true, name: 'Update' })).toBeEnabled();

    const updateCommand = socketMessage(computer);
    await page.getByRole('button', { exact: true, name: 'Update' }).click();
    await expect(page.getByText('Download requested')).toBeVisible();
    expect(await updateCommand).toMatchObject({
        release: { release: { version: '1.1.0' } },
        type: 'update',
    });
    await reportProgress(computer, 'downloading', 'Downloading Grotto Computer 1.1.0.', {
        downloaded: 5 * 1024 * 1024,
        total: 10 * 1024 * 1024,
    });
    await expect(
        page.getByText('Downloading Grotto Computer 1.1.0', { exact: true })
    ).toBeVisible();
    await expect(page.getByText('5.0 MB of 10.0 MB')).toBeVisible();
    await expect(
        page.getByRole('progressbar', { name: 'Downloading Grotto Computer' })
    ).toHaveAttribute('aria-valuenow', '50');
    await reportProgress(computer, 'verifying', 'Verifying signature and integrity.');
    await expect(
        page.getByText('Verifying signature and integrity', { exact: true })
    ).toBeVisible();
    await reportProgress(computer, 'installing', 'Installing signed release.');
    await expect(page.getByText('Installing update')).toBeVisible();
    await reportProgress(computer, 'waiting-for-agents', 'Waiting for active Agents.');
    await expect(page.getByText('Waiting for active Agents…')).toBeVisible();
    await expect(page.getByText('1 active Agent is finishing.')).toBeVisible();
    await reportProgress(computer, 'restarting', 'Restarting Computer.');
    await expect(page.getByText('Restarting Grotto Computer')).toBeVisible();
    computer.close();
    await page.reload();
    await expect(page.getByText('Restarting Grotto Computer')).toBeVisible();

    const reconnectedComputer = new WebSocket(
        `ws://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/attachment`
    );
    await socketOpen(reconnectedComputer);
    const reconnected = socketMessage(reconnectedComputer);
    sendBootstrap(reconnectedComputer, credential, 'complete');
    expect(await reconnected).toMatchObject({ mode: 'ordinary' });
    await expect(page.getByText('Update complete')).toBeVisible();

    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Up to date', { exact: true })).toBeVisible();
    await expect(page.getByText('Grotto Computer 1.1.0 is the latest version.')).toBeVisible();
    await expect(page.getByRole('button', { exact: true, name: 'Update' })).toBeDisabled();
    reconnectedComputer.close();
});

function socketOpen(socket: WebSocket) {
    return new Promise<void>((resolve, reject) => {
        socket.addEventListener('open', () => resolve(), { once: true });
        socket.addEventListener('error', () => reject(new Error('Computer socket failed.')), {
            once: true,
        });
    });
}

function sendBootstrap(socket: WebSocket, credential: string, phase: 'complete' | 'idle') {
    socket.send(
        JSON.stringify({
            architecture: 'arm64',
            bootstrapProtocolVersion: 1,
            credential,
            health: 'healthy',
            operatingSystem: 'darwin',
            productVersion: phase === 'complete' ? '1.1.0' : '1.0.0',
            protocolVersion: phase === 'complete' ? computerProtocolVersion : 999,
            type: 'bootstrap',
            update: {
                activeAgentCount: null,
                detail: phase === 'complete' ? 'Grotto Computer updated successfully.' : null,
                downloadedBytes: null,
                failedPhase: null,
                phase,
                targetVersion: phase === 'complete' ? '1.1.0' : null,
                totalBytes: null,
                updatedAt: new Date().toISOString(),
            },
        })
    );
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
    phase:
        | 'complete'
        | 'downloading'
        | 'installing'
        | 'restarting'
        | 'verifying'
        | 'waiting-for-agents',
    detail: string,
    bytes?: { downloaded: number; total: number }
) {
    socket.send(
        JSON.stringify({
            type: 'update-progress',
            update: {
                activeAgentCount: phase === 'waiting-for-agents' ? 1 : null,
                detail,
                downloadedBytes: bytes?.downloaded ?? null,
                failedPhase: null,
                phase,
                targetVersion: '1.1.0',
                totalBytes: bytes?.total ?? null,
                updatedAt: new Date().toISOString(),
            },
        })
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
}
