import { createHash } from 'node:crypto';
import { computerBootstrapProtocolVersion, computerProtocolVersion } from '@tavern/api';
import { WebSocket } from 'ws';
import { readClerkSessionFixture, signInAsClerkHuman } from '../support/clerk-session.ts';
import { createHostedClient } from '../support/hosted-server.ts';
import { expect, test } from '../support/test.ts';

const computerCredential = 'fresh-server-computer-credential-000000000';

test('a fresh Server stays gated until a Computer reports usable inventory', async ({ page }) => {
    await signInAsClerkHuman(page);
    await page.goto('/s');

    const nameField = page.getByLabel('Name');
    const serverSwitcher = page.getByRole('button', { name: /^Switch Server \(current:/u });
    await expect(nameField.or(serverSwitcher)).toBeVisible();
    if (await serverSwitcher.isVisible()) {
        await serverSwitcher.click();
        await page.getByRole('menuitem', { name: 'Switch or create Server…' }).click();
    }

    await nameField.fill('Grotto HQ');
    await page.getByLabel('Address').fill('grotto-hq');
    await page.getByRole('button', { name: 'Create Server' }).click();

    await expect(page).toHaveURL(/\/s\/grotto-hq$/u);
    await expect(page.getByRole('heading', { level: 1, name: 'Connect a Computer' })).toBeVisible();
    await expect(page.getByText('grotto-computer setup /grotto-hq')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message all' })).toHaveCount(0);

    // Even a direct destination stays behind the route-level gate.
    await page.goto('/s/grotto-hq/members');
    await expect(page.getByRole('heading', { level: 1, name: 'Connect a Computer' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toHaveCount(0);

    const owner = createHostedClient(readClerkSessionFixture().token);
    const setup = await owner.computer.begin.mutate({
        credentialHash: createHash('sha256').update(computerCredential).digest('hex'),
        slug: 'grotto-hq',
    });
    await page.goto(setup.approvalUrl);
    await page.getByRole('button', { name: 'Approve Computer' }).click();
    await expect(page.getByText('Approved. Return to Grotto Computer.')).toBeVisible();

    await page.goto('/s/grotto-hq');
    const socket = await connectComputer();
    await expect(page.getByText('Detecting runtimes…')).toBeVisible();

    socket.send(JSON.stringify({ inventory: { runtimes: [] }, type: 'report' }));
    await expect(
        page.getByText('This Computer did not report a usable runtime and model.')
    ).toBeVisible();

    socket.send(JSON.stringify({ inventory: usableInventory, type: 'report' }));
    await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Cove' })).toBeVisible();
    await expect(page.getByLabel('Runtime')).toContainText('Codex');
    await expect(page.getByLabel('Model')).toContainText('GPT-5.6 Sol');
    await expect(page.getByRole('button', { name: 'Create Cove' })).toBeDisabled();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toBeVisible();
    await page.goto('/s/grotto-hq/tasks');
    await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toHaveCount(0);

    socket.close();
    await expect(page.getByRole('alert')).toContainText('The Computer disconnected');
    const reconnected = await connectComputer();
    await expect(page.getByRole('alert')).toHaveCount(0);
    reconnected.close();
});

test('a human without membership cannot open the Server', async ({ page }) => {
    await page.goto('/s/grotto-hq');

    await expect(page.getByText('Server unavailable')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message all' })).toHaveCount(0);
});

const usableInventory = {
    runtimes: [
        {
            id: 'codex',
            label: 'Codex',
            models: [{ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
        },
    ],
};

async function connectComputer() {
    const socket = new WebSocket(
        `ws://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/attachment`
    );
    await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
    });
    socket.send(
        JSON.stringify({
            architecture: 'arm64',
            bootstrapProtocolVersion: computerBootstrapProtocolVersion,
            credential: computerCredential,
            health: 'healthy',
            operatingSystem: 'darwin',
            productVersion: '1.1.5',
            protocolVersion: computerProtocolVersion,
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
        socket.once('message', () => resolve());
        socket.once('close', (code, reason) => {
            reject(new Error(`Computer socket closed ${code}: ${reason.toString()}`));
        });
    });
    return socket;
}
