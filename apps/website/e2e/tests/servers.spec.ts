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
    await expect(page.getByRole('button', { name: 'Create Cove' })).toBeEnabled();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toBeVisible();
    await page.goto('/s/grotto-hq/tasks');
    await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toHaveCount(0);

    socket.close();
    await expect(page.getByRole('alert')).toContainText('Reconnect this Computer, then try again.');
    const reconnected = await connectComputer();
    await expect(page.getByRole('alert')).toHaveCount(0);

    const firstApplication = socketMessage(reconnected, 'cove-apply');
    await page.getByRole('button', { name: 'Create Cove' }).click();
    const command = await firstApplication;
    expect(command).toMatchObject({ factoryKind: 'cove', type: 'cove-apply' });
    await expect(page.getByText('Getting Cove ready…')).toBeVisible();
    reconnected.send(
        JSON.stringify({
            agentId: command.agentId,
            applicationId: command.applicationId,
            error: 'Workspace seed failed.',
            factoryKind: 'cove',
            status: 'failed',
            type: 'cove-apply-result',
        })
    );
    await expect(page.getByRole('alert')).toContainText(
        'Cove isn’t ready yet. Make sure this Computer is connected, then try again.'
    );
    await expect(page.getByText('Workspace seed failed.')).toHaveCount(0);

    const replay = socketMessage(reconnected, 'cove-apply');
    await page.getByRole('button', { name: 'Try again' }).click();
    expect(await replay).toMatchObject({
        agentId: command.agentId,
        applicationId: command.applicationId,
    });
    const greetingStartPromise = socketMessage(reconnected, 'start');
    reconnected.send(
        JSON.stringify({
            agentId: command.agentId,
            applicationId: command.applicationId,
            factoryKind: 'cove',
            status: 'applied',
            type: 'cove-apply-result',
        })
    );
    await expect(page).toHaveURL(/\/s\/grotto-hq\/chats\//u);
    await expect(page.getByText('onboarding-owner', { exact: true }).first()).toBeVisible();
    const greetingStart = await greetingStartPromise;
    expect(greetingStart).toMatchObject({
        agentId: command.agentId,
        inbox: [
            {
                senderHandle: 'onboarding',
                senderType: 'system',
                target: '#onboarding-owner',
            },
        ],
        type: 'start',
    });
    await expect(page.getByText('Getting Cove ready…')).toHaveCount(0);

    // Onboarding is complete before Cove speaks. A failed first turn stays in
    // the unlocked App and recovers through the ordinary Agent controls.
    reconnected.send(
        JSON.stringify({
            agentId: command.agentId,
            endedAt: new Date().toISOString(),
            messageCount: 0,
            outputProduced: false,
            runId: greetingStart.runId,
            startedAt: new Date().toISOString(),
            status: 'failed',
            summary: 'provider unavailable',
            type: 'turn',
        })
    );
    await page.goto('/s/grotto-hq/members');
    await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toHaveCount(0);
    const coveRow = page.getByRole('row', { name: 'Cove' });
    await expect(coveRow).toBeVisible();
    await coveRow.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cove' })).toBeVisible();
    await expect(page.getByText('@cove', { exact: true })).toBeVisible();
    await expect(page.getByText('Onboarding Assistant', { exact: true })).toBeVisible();
    await expect(page.getByText('admin', { exact: true })).toBeVisible();

    const restartFramePromise = socketMessage(reconnected, 'agent-restart');
    const retryStartPromise = socketMessage(reconnected, 'start');
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    expect(await restartFramePromise).toMatchObject({
        agentId: command.agentId,
        type: 'agent-restart',
    });
    const retryStart = await retryStartPromise;
    expect(retryStart).toMatchObject({
        agentId: command.agentId,
        inbox: greetingStart.inbox,
        type: 'start',
    });

    const runnerToken = await mintRunner({
        agentId: String(command.agentId),
        chatId: String(retryStart.chatId),
        runId: String(retryStart.runId),
    });
    const greeting = 'Hi, I’m Cove. Let’s turn your first idea into real work.';
    await sendAgentGreeting(runnerToken, greeting, String(command.applicationId));
    await page.goto('/s/grotto-hq');
    const messages = page.getByLabel('Messages', { exact: true });
    await expect(messages.getByText(greeting, { exact: true })).toBeVisible();
    const coveAvatar = messages.getByRole('img', { name: 'Cove' });
    await expect(coveAvatar).toBeVisible();
    const avatarUrl = await coveAvatar.getAttribute('src');
    expect(avatarUrl).toMatch(/\/api\/avatars\/avt_[a-z0-9]{16}$/u);
    const avatarResponse = await page.request.get(String(avatarUrl));
    expect(avatarResponse.ok()).toBe(true);
    expect(
        createHash('sha256')
            .update(await avatarResponse.body())
            .digest('hex')
    ).toBe('c4940cf58f438175d5c781e513471f70865eaa803301013f7526e557ada29391');

    reconnected.send(
        JSON.stringify({
            agentId: command.agentId,
            endedAt: new Date().toISOString(),
            messageCount: 1,
            outputProduced: true,
            runId: retryStart.runId,
            startedAt: new Date().toISOString(),
            status: 'completed',
            summary: 'greeted',
            type: 'turn',
        })
    );
    reconnected.send(
        JSON.stringify({
            agentId: command.agentId,
            applicationId: command.applicationId,
            factoryKind: 'cove',
            status: 'applied',
            type: 'cove-apply-result',
        })
    );
    await page.goto('/s/grotto-hq');
    await expect(page).toHaveURL(/\/s\/grotto-hq\/chats\//u);
    await expect(page.getByText('onboarding-owner', { exact: true }).first()).toBeVisible();
    await expect(messages.getByText(greeting, { exact: true })).toHaveCount(1);
    await expect(page.getByText('Getting Cove ready…')).toHaveCount(0);
    await page.goto('/s/grotto-hq/members');
    await page.getByRole('row', { name: 'Cove' }).click();
    await page.getByRole('button', { name: 'Full Reset' }).click();
    const resetDialog = page.getByRole('alertdialog', { name: 'Full Reset?' });
    await expect(resetDialog).toContainText("Cove's factory onboarding workspace");
    const resetFramePromise = socketMessage(reconnected, 'agent-reset');
    await resetDialog.getByRole('button', { name: 'Full Reset' }).click();
    expect(await resetFramePromise).toMatchObject({
        agentId: command.agentId,
        kind: 'full',
        type: 'agent-reset',
    });

    await page.getByRole('button', { name: 'Delete Agent' }).click();
    const deleteDialog = page.getByRole('alertdialog', { name: 'Delete Agent' });
    await deleteDialog.getByLabel(/Type Cove to confirm/iu).fill('Cove');
    await deleteDialog.getByRole('button', { name: 'Delete Agent' }).click();
    await expect(page.getByRole('row', { name: 'Cove' })).toHaveCount(0);
    await page.goto('/s/grotto-hq');
    await expect(page).toHaveURL(/\/s\/grotto-hq\/chats\//u);
    await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toHaveCount(0);
    await expect(page.getByRole('row', { name: 'onboarding-owner' })).toHaveCount(1);
    await expect(messages.getByText(greeting, { exact: true })).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('row', { name: 'onboarding-owner' })).toHaveCount(1);
    await expect(messages.getByText(greeting, { exact: true })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toHaveCount(0);
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

async function socketMessage(socket: WebSocket, type: string) {
    return await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`No ${type} frame arrived.`)), 5000);
        socket.on('message', function onMessage(raw) {
            const frame = JSON.parse(raw.toString()) as Record<string, unknown>;
            if (frame.type !== type) {
                return;
            }
            clearTimeout(timeout);
            socket.off('message', onMessage);
            resolve(frame);
        });
    });
}

async function mintRunner(input: { agentId: string; chatId: string; runId: string }) {
    const response = await fetch(
        `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/runner/mint`,
        {
            body: JSON.stringify({
                ...input,
                credentialHash: createHash('sha256').update(computerCredential).digest('hex'),
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        }
    );
    expect(response.ok).toBe(true);
    return ((await response.json()) as { runnerToken: string }).runnerToken;
}

async function sendAgentGreeting(token: string, content: string, applicationId: string) {
    const response = await fetch(
        `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/api/agent/messages/send`,
        {
            body: JSON.stringify({
                content,
                nonce: `cove-greeting:${applicationId}`,
                target: '#onboarding-owner',
            }),
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            method: 'POST',
        }
    );
    expect(response.ok).toBe(true);
}
