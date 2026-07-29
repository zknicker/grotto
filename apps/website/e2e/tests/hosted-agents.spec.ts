import { createHash } from 'node:crypto';
import { computerBootstrapProtocolVersion, computerProtocolVersion } from '@tavern/api';
import { appProtocolHeaders, appProtocolVersion } from '@tavern/api/app-protocol';
import { createTRPCClient, httpLink } from '@trpc/client';
import { WebSocket } from 'ws';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { readClerkSessionFixture, signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

const computerCredential = 'agent-e2e-credential-0000000000000000';
const inventory = {
    runtimes: [
        {
            id: 'codex',
            label: 'Codex',
            models: [
                { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
                { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
            ],
        },
    ],
};

test('creates Cove after inventory is reported and fails closed on unreported config', async ({
    page,
}) => {
    await signInAsClerkHuman(page);
    await page.goto('/s');
    await page.getByLabel('Name').fill('Agent HQ');
    await page.getByLabel('Address').fill('agent-hq');
    await page.getByRole('button', { name: 'Create Server' }).click();

    const session = readClerkSessionFixture();
    const owner = hostedClient(session.token);
    const setup = await owner.computer.begin.mutate({
        credentialHash: createHash('sha256').update(computerCredential).digest('hex'),
        slug: 'agent-hq',
    });
    await page.goto(setup.approvalUrl);
    await page.getByRole('button', { name: 'Approve Computer' }).click();
    await expect(page.getByText('Approved. Return to Grotto Computer.')).toBeVisible();

    // The Computer reports its sanitized inventory over its attachment socket.
    await reportInventory();

    await page.goto('/s/agent-hq/agents');
    await expect(page.getByRole('heading', { level: 1, name: 'Agents' })).toBeVisible();
    await expect(page.getByLabel('Runtime')).toContainText('Codex');
    await expect(page.getByLabel('Model')).toContainText('GPT-5.6 Sol');
    // Guided creation offers Cove as the default first Agent.
    await expect(page.locator('#agent-name')).toHaveValue('Cove');
    await page.getByRole('button', { name: 'Create Agent' }).click();

    await expect(page.getByText('Cove')).toBeVisible();
    await expect(page.getByLabel('blob agent')).toBeVisible();
    await expect(page.getByText('pending')).toBeVisible();

    // Deletion requires the exact Agent name. Cancel leaves this isolated
    // e2e Agent intact for the adjacent DM and contract assertions.
    await page.getByRole('button', { name: 'Delete Agent' }).click();
    const confirmation = page.getByRole('alertdialog');
    await expect(confirmation).toContainText('permanently destroys');
    const deleteButton = confirmation.getByRole('button', { name: 'Delete Agent' });
    const nameField = confirmation.getByLabel(/Type Cove to confirm/iu);
    await expect(deleteButton).toBeDisabled();
    await nameField.fill('cove');
    await expect(deleteButton).toBeDisabled();
    await nameField.fill('Cove');
    await expect(deleteButton).toBeEnabled();
    await confirmation.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirmation).toBeHidden();

    // The DM appears as an ordinary Agent DM, not a special onboarding Channel.
    await page.goto('/s/agent-hq');
    await expect(page.getByRole('button', { name: /blob agent.*Cove/iu })).toBeVisible();

    // Cross-Computer / unreported references fail closed at the contract.
    const [computer] = await owner.computer.list.query({ serverId: setup.serverId });
    await expect(
        owner.agent.create.mutate({
            computerId: computer.id,
            displayName: 'Ghost',
            handle: 'ghost',
            modelId: 'gpt-9-unreported',
            role: 'member',
            runtimeId: 'codex',
            serverId: setup.serverId,
        })
    ).rejects.toThrow(/does not report the model/iu);
});

function reportInventory() {
    return new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(
            `ws://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/attachment`
        );
        socket.on('error', reject);
        socket.on('close', (code, reason) => {
            if (code !== 1005) {
                reject(new Error(`Attachment socket closed ${code}: ${reason.toString()}`));
            }
        });
        socket.on('message', (raw) => {
            if (JSON.parse(raw.toString()).type === 'bootstrap-accepted') {
                socket.send(JSON.stringify({ agents: [], inventory, type: 'report' }));
                socket.close();
                resolve();
            }
        });
        socket.on('open', () => {
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
        });
    });
}

function hostedClient(token: string) {
    return createTRPCClient<GrottoRouter>({
        links: [
            httpLink({
                headers: {
                    [appProtocolHeaders.productVersion]: 'e2e',
                    [appProtocolHeaders.protocolVersion]: String(appProtocolVersion),
                    authorization: `Bearer ${token}`,
                },
                url: `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/trpc`,
            }),
        ],
    });
}
