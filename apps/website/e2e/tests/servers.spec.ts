import { type ChildProcess, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computerBootstrapProtocolVersion, computerProtocolVersion } from '@grotto/api';
import { WebSocket } from 'ws';
import { readClerkSessionFixture, signInAsClerkHuman } from '../support/clerk-session.ts';
import { createClient } from '../support/server.ts';
import { expect, test } from '../support/test.ts';

test('a fresh Server stays gated until a Computer reports usable inventory', async ({
    browser,
    page,
}) => {
    test.setTimeout(120_000);
    await signInAsClerkHuman(page);
    await page.goto('/s');

    const nameField = page.getByLabel('Name');
    const serverSwitcher = page.getByRole('button', { name: /^Switch Server \(current:/u });
    const createServerStep = page.getByRole('button', { name: 'Create a Server' });
    await expect(createServerStep.or(serverSwitcher)).toBeVisible();
    if (await serverSwitcher.isVisible()) {
        await serverSwitcher.click();
        await expect(page.getByRole('menuitem', { name: 'Join server' })).toBeVisible();
        await page.getByRole('menuitem', { name: 'Create server' }).click();
    } else {
        await createServerStep.click();
    }
    await expect(nameField).toBeVisible();

    await nameField.fill('Grotto HQ');
    const addressField = page.getByLabel('Address');
    await expect(addressField).toHaveValue('grotto-hq');
    await addressField.fill('custom-address');
    await nameField.fill('Hearth');
    await expect(addressField).toHaveValue('custom-address');
    await addressField.fill('grotto-hq');
    await page.getByRole('button', { name: 'Create Server' }).click();

    await expect(page).toHaveURL(/\/s\/grotto-hq$/u);
    await expect(page.getByRole('heading', { level: 1, name: 'Connect a Computer' })).toBeVisible();
    await expect(
        page.getByText('curl -fsSL https://releases.grotto.sh/computer/install.sh | sh')
    ).toBeVisible();
    await expect(page.getByText('$HOME/.local/bin/grotto-computer setup /grotto-hq')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message all' })).toHaveCount(0);

    // Even a direct destination stays behind the route-level gate.
    await page.goto('/s/grotto-hq/members');
    await expect(page.getByRole('heading', { level: 1, name: 'Connect a Computer' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Members' })).toHaveCount(0);

    const owner = createClient(readClerkSessionFixture().token);
    const server = await owner.server.bySlug.query({ slug: 'grotto-hq' });
    const computer = await startComputerSetup({ serverId: server.id, slug: 'grotto-hq' });
    try {
        const approvalContext = await browser.newContext();
        let attachment: Awaited<ReturnType<typeof computer.waitForAttachment>>;
        try {
            const approvalPage = await approvalContext.newPage();
            await signInAsClerkHuman(approvalPage);
            await approvalPage.goto(computer.verificationUrl);
            await expect(
                approvalPage.getByRole('heading', { name: 'Approve Grotto Computer?' })
            ).toBeVisible();

            await page.context().setOffline(true);
            await approvalPage.getByRole('button', { name: 'Approve Grotto Computer' }).click();
            await expect(
                approvalPage.getByRole('heading', { name: 'Signed in — finishing the connection' })
            ).toBeVisible();
            await expect(
                approvalPage.getByRole('heading', {
                    name: 'Computer connected — you can close this page',
                })
            ).toHaveCount(0);

            attachment = await computer.waitForAttachment();
            expect(attachment).toMatchObject({ serverId: server.id, slug: 'grotto-hq' });
            expect(
                (await stat(join(computer.dataRoot, 'servers', server.id, 'attachment.json')))
                    .mode & 0o777
            ).toBe(0o600);
            await expect(
                approvalPage.getByRole('heading', {
                    name: 'Computer connected — you can close this page',
                })
            ).toBeVisible();
            await expect(
                approvalPage.getByRole('button', { name: 'Close this page' })
            ).toBeVisible();
            await expect(
                approvalPage.getByText('If this page stays open, close it manually.')
            ).toBeVisible();

            await expect
                .poll(
                    async () =>
                        (await owner.server.bySlug.query({ slug: 'grotto-hq' })).onboarding.phase
                )
                .toBe('awaiting-cove');
            await expect(
                page.getByRole('heading', { level: 1, name: 'Connect a Computer' })
            ).toBeVisible();
            await page.context().setOffline(false);
            await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toBeVisible();
        } finally {
            await page.context().setOffline(false);
            await approvalContext.close();
        }

        await expect(page.getByRole('img', { name: 'Cove' })).toBeVisible();
        await expect(page.getByLabel('Runtime')).toContainText('Codex');
        await expect(page.getByLabel('Model')).toContainText('GPT-5.6 Sol');
        await expect(page.getByRole('button', { name: 'Create Cove' })).toBeEnabled();

        // The rest of this tracer exercises Cove's background application path
        // through the deterministic socket fixture. The real Computer has
        // already proved the setup, persistence, and inventory boundary above.
        await computer.stop();
        const socket = await connectComputer(attachment.credential);
        await expect(page.getByRole('alert')).toHaveCount(0);

        await page.reload();
        await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toBeVisible();
        await page.goto('/s/grotto-hq/tasks');
        await expect(page.getByRole('heading', { level: 1, name: 'Meet Cove' })).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toHaveCount(0);

        socket.close();
        await expect(page.getByRole('alert')).toContainText('This Computer is offline');
        await expect(page.getByRole('alert')).toContainText('grotto-computer start');
        const reconnected = await connectComputer(attachment.credential);
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
        await expect(page.getByRole('alert')).toContainText('Cove’s setup didn’t finish');
        await expect(page.getByRole('alert')).toContainText('grotto-computer logs');
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
        const coveRow = page.getByRole('link', { name: 'Cove' });
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
            credential: attachment.credential,
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
        await page.getByRole('link', { name: 'Cove' }).click();
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
        await expect(page.getByRole('link', { name: 'Cove' })).toHaveCount(0);
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
    } finally {
        await computer.dispose();
    }
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

interface StoredAttachment {
    computerId: string;
    credential: string;
    serverId: string;
    serverOrigin: string;
    slug: string;
}

const computerEntrypoint = fileURLToPath(
    new URL('../../../../apps/computer/src/index.ts', import.meta.url)
);

async function startComputerSetup(options: { serverId: string; slug: string }) {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-e2e-computer-'));
    const serverPort = process.env.GROTTO_SERVER_PORT;
    if (!serverPort) {
        throw new Error('The hosted Server port is not configured.');
    }
    const serverOrigin = `http://127.0.0.1:${serverPort}`;
    const child = spawn('bun', [computerEntrypoint, 'setup', `/${options.slug}`], {
        env: {
            ...process.env,
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_DISABLE_BROWSER_OPEN: '1',
            GROTTO_COMPUTER_INVENTORY: JSON.stringify(usableInventory),
            GROTTO_COMPUTER_ONESHOT: '1',
            GROTTO_COMPUTER_USAGE_DISABLED: '1',
            GROTTO_SERVER_ORIGIN: serverOrigin,
        },
        stderr: 'pipe',
        stdin: 'ignore',
        stdout: 'pipe',
    });
    const exited = waitForChild(child);
    const stdout = captureProcessOutput(child.stdout);
    const stderr = captureProcessOutput(child.stderr);
    let stopped = false;

    try {
        const verification = await waitForOutput(stdout, /Verification URL: (https?:\/\/\S+)/u);
        return {
            dataRoot,
            verificationUrl: verification[1],
            async waitForAttachment() {
                return await waitForStoredAttachment(dataRoot, options.serverId);
            },
            async stop() {
                if (stopped) {
                    return;
                }
                if (child.exitCode !== null || child.signalCode !== null) {
                    const exitCode = await exited;
                    if (exitCode !== 0) {
                        throw new Error(`grotto-computer setup failed:\n${stderr.text}`);
                    }
                    stopped = true;
                    return;
                }
                const result = await runComputerCli(['stop'], dataRoot, serverOrigin);
                if (result.exitCode !== 0) {
                    throw new Error(
                        `grotto-computer stop failed:\n${result.stderr || result.stdout}`
                    );
                }
                await exited;
                stopped = true;
            },
            async dispose() {
                try {
                    await this.stop();
                } catch (cause) {
                    try {
                        child.kill('SIGTERM');
                    } catch {}
                    await exited.catch(() => undefined);
                    throw new Error(
                        `${cause instanceof Error ? cause.message : String(cause)}\n${stderr.text}`
                    );
                } finally {
                    await rm(dataRoot, { force: true, recursive: true });
                }
            },
        };
    } catch (cause) {
        try {
            child.kill('SIGTERM');
        } catch {}
        await exited.catch(() => undefined);
        await rm(dataRoot, { force: true, recursive: true });
        throw new Error(
            `${cause instanceof Error ? cause.message : String(cause)}\n${stderr.text}\n${stdout.text}`
        );
    }
}

async function runComputerCli(args: string[], dataRoot: string, serverOrigin: string) {
    const child = spawn('bun', [computerEntrypoint, ...args], {
        env: {
            ...process.env,
            GROTTO_COMPUTER_DATA_ROOT: dataRoot,
            GROTTO_COMPUTER_DISABLE_BROWSER_OPEN: '1',
            GROTTO_COMPUTER_USAGE_DISABLED: '1',
            GROTTO_SERVER_ORIGIN: serverOrigin,
        },
        stderr: 'pipe',
        stdin: 'ignore',
        stdout: 'pipe',
    });
    const exited = waitForChild(child);
    const stdout = captureProcessOutput(child.stdout);
    const stderr = captureProcessOutput(child.stderr);
    const [exitCode] = await Promise.all([exited, stdout.done, stderr.done]);
    return { exitCode, stderr: stderr.text, stdout: stdout.text };
}

function waitForChild(child: ChildProcess) {
    return new Promise<number>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code) => resolve(code ?? 1));
    });
}

function captureProcessOutput(stream: NodeJS.ReadableStream) {
    let text = '';
    const done = new Promise<void>((resolve) => {
        stream.setEncoding?.('utf8');
        stream.on('data', (chunk: string | Buffer) => {
            text += String(chunk);
        });
        stream.on('end', resolve);
        stream.on('error', resolve);
    });
    return {
        done,
        get text() {
            return text;
        },
    };
}

async function waitForOutput(output: ReturnType<typeof captureProcessOutput>, pattern: RegExp) {
    const deadline = Date.now() + 30_000;
    for (;;) {
        const match = output.text.match(pattern);
        if (match) {
            return match;
        }
        if (Date.now() >= deadline) {
            throw new Error(`Timed out waiting for Computer output matching ${pattern}.`);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
}

async function waitForStoredAttachment(dataRoot: string, serverId: string) {
    const destination = join(dataRoot, 'servers', serverId, 'attachment.json');
    const deadline = Date.now() + 30_000;
    for (;;) {
        try {
            return JSON.parse(await readFile(destination, 'utf8')) as StoredAttachment;
        } catch {
            if (Date.now() >= deadline) {
                throw new Error(`Timed out waiting for ${destination}.`);
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
    }
}

async function connectComputer(credential: string) {
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
            credential,
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

async function mintRunner(input: {
    agentId: string;
    chatId: string;
    credential: string;
    runId: string;
}) {
    const response = await fetch(
        `http://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/runner/mint`,
        {
            body: JSON.stringify({
                agentId: input.agentId,
                chatId: input.chatId,
                credentialHash: createHash('sha256').update(input.credential).digest('hex'),
                runId: input.runId,
            }),
            headers: { 'content-type': 'application/json' },
            method: 'POST',
        }
    );
    const body = await response.text();
    expect(response.ok, body).toBe(true);
    return (JSON.parse(body) as { runnerToken: string }).runnerToken;
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
