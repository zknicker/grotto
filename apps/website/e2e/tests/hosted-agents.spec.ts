import { createHash } from 'node:crypto';
import { computerBootstrapProtocolVersion, computerProtocolVersion } from '@tavern/api';
import { WebSocket } from 'ws';
import { createHostedTestServer } from '../support/hosted-server.ts';
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
    const { client: owner } = await createHostedTestServer(page, {
        displayName: 'Agent HQ',
        slug: 'agent-hq',
    });
    const setup = await owner.computer.begin.mutate({
        credentialHash: createHash('sha256').update(computerCredential).digest('hex'),
        slug: 'agent-hq',
    });
    await page.goto(setup.approvalUrl);
    await page.getByRole('button', { name: 'Approve Computer' }).click();
    await expect(page.getByText('Approved. Return to Grotto Computer.')).toBeVisible();

    // The Computer reports its sanitized inventory over its attachment socket.
    await reportInventory();

    await page.goto('/s/agent-hq/members');
    await page.getByRole('button', { name: 'Create Agent' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Create Agent' });
    await expect(createDialog.getByLabel('Runtime')).toContainText('Codex');
    await expect(createDialog.getByLabel('Model')).toContainText('GPT-5.6 Sol');
    // Guided creation offers Cove as the default first Agent.
    await expect(createDialog.getByRole('textbox', { name: 'Name' })).toHaveValue('Cove');
    await createDialog.getByRole('button', { name: 'Create Agent' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Cove' })).toBeVisible();
    await expect(page.getByText('Applies when Computer reconnects')).toBeVisible();

    // The current hosted profile owns the same lifecycle and configuration
    // contracts the retired local profile exposed.
    for (const section of ['Overview', 'Activity', 'Reminders', 'Workspace']) {
        await expect(page.getByRole('radio', { name: section })).toBeVisible();
    }
    const restart = page.getByRole('button', { name: 'Restart', exact: true });
    await expect(restart).toBeVisible();
    await restart.click();
    await expect(restart).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Start Fresh Session' })).toBeVisible();
    await page.getByRole('button', { name: 'Full Reset' }).click();
    const resetConfirmation = page.getByRole('alertdialog', { name: 'Full Reset?' });
    await expect(resetConfirmation).toContainText('MEMORY.md');
    await expect(resetConfirmation).toContainText('kept');
    await resetConfirmation.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Edit' }).click();
    const runtimeDialog = page.getByRole('dialog', { name: 'Runtime Config' });
    await runtimeDialog.getByLabel('Model').click();
    await page.getByRole('option', { name: 'GPT-5.6 Terra' }).click();
    await runtimeDialog.getByRole('button', { name: 'Save' }).click();
    await expect(runtimeDialog).toBeHidden();
    await expect(page.getByText('GPT-5.6 Terra', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('GPT-5.6 Terra', { exact: true })).toBeVisible();

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
    await expect(page.getByRole('row', { name: 'Cove' })).toBeVisible();

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
