import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTRPCClient, httpLink } from '@trpc/client';
import { WebSocket } from 'ws';
import { AttachmentMcpRuntime } from '../../../computer/src/mcp-runtime.ts';
import { startControlledOAuthMcpProvider } from '../../../computer/src/test-fixtures/controlled-oauth-mcp.ts';
import type { GrottoRouter } from '../../../server/src/grotto-api/router.ts';
import { readClerkSessionFixture, signInAsClerkHuman } from '../support/clerk-session.ts';
import { expect, test } from '../support/test.ts';

test('connects and reconnects a custom OAuth MCP account through the existing UI', async ({
    page,
}) => {
    const provider = await startControlledOAuthMcpProvider();
    const root = await mkdtemp(join(tmpdir(), 'grotto-e2e-mcp-'));
    const credential = 'controlled-computer-credential-0000';
    let socket: WebSocket | null = null;
    let runtime: AttachmentMcpRuntime | null = null;
    try {
        await signInAsClerkHuman(page);
        await page.goto('/s');
        await page.getByLabel('Name').fill('OAuth HQ');
        await page.getByLabel('Address').fill('oauth-hq');
        await page.getByRole('button', { name: 'Create Server' }).click();
        await page.waitForURL('/s/oauth-hq');

        const owner = hostedClient(readClerkSessionFixture().token);
        const setup = await owner.computer.begin.mutate({
            credentialHash: createHash('sha256').update(credential).digest('hex'),
            slug: 'oauth-hq',
        });
        const approvalUrl = new URL(setup.approvalUrl);
        const approved = await owner.computer.approve.mutate({
            approvalId: approvalUrl.searchParams.get('approval') ?? '',
            secret: approvalUrl.searchParams.get('secret') ?? '',
        });
        runtime = new AttachmentMcpRuntime(join(root, setup.serverId, 'mcp'));
        socket = await connectComputer(credential, runtime);
        const agent = await owner.agent.create.mutate({
            computerId: approved.computerId,
            displayName: 'Cove',
            handle: 'cove',
            modelId: 'controlled-model',
            role: 'member',
            runtimeId: 'controlled-runtime',
            serverId: setup.serverId,
        });

        await page.goto('/s/oauth-hq/connections');
        await expect(page.getByRole('heading', { exact: true, name: 'Connections' })).toBeVisible();
        await page.getByRole('button', { name: 'Add connection' }).click();
        await expect(page.getByText('Add custom connection')).toBeVisible();
        await page.getByLabel('Name').fill('Controlled OAuth account');
        await page.getByLabel('URL').fill(`${provider.origin}/mcp`);
        await page.getByText('Authentication').locator('..').getByRole('combobox').click();
        await page.getByRole('option', { name: 'OAuth' }).click();
        const addResponse = page.waitForResponse((response) => response.url().includes('mcp.add'));
        await page.getByRole('button', { name: 'Add connection', exact: true }).last().click();
        const added = await addResponse;
        expect(added.ok(), await added.text()).toBe(true);

        const row = page.getByRole('button', { name: /Controlled OAuth account/u });
        await expect(row).toBeVisible();
        await row.click();
        await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Connect', exact: true }).click();
        await expect(
            page.getByRole('alertdialog', { name: 'Trust this sign-in service?' })
        ).toBeVisible();
        const popupPromise = page.waitForEvent('popup');
        await page.getByRole('button', { name: 'Trust and continue' }).click();
        const popup = await popupPromise;
        await expect(
            popup.getByRole('heading', { name: 'Connect Controlled OAuth account' })
        ).toBeVisible();
        await popup.getByRole('button', { name: 'Allow' }).click();
        await expect(popup.getByRole('heading', { name: 'Connection complete' })).toBeVisible();

        await expect(page.getByText('Connected', { exact: true }).last()).toBeVisible();
        await expect(
            page.getByRole('dialog').getByText('controlled@example.test', { exact: true })
        ).toBeVisible();
        await expect(page.getByText('echo', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reconnect' })).toBeVisible();

        await page.keyboard.press('Escape');
        await page.goto('/s/oauth-hq/agents');
        const grantResponse = page.waitForResponse((response) =>
            response.url().includes('mcp.setGrant')
        );
        await page.getByRole('switch', { name: /Grant echo to Cove/u }).click();
        expect((await grantResponse).ok()).toBe(true);
        const [connection] = await owner.mcp.list.query({ serverId: setup.serverId });
        expect(connection?.grants).toContainEqual({
            agentId: agent.agent.id,
            connectionId: connection.id,
            toolName: 'echo',
        });
        await expect(
            runtime.invoke({
                agentId: agent.agent.id,
                args: { value: 'ready' },
                connectionId: connection.id,
                toolName: 'echo',
            })
        ).resolves.toMatchObject({
            content: [{ text: 'controlled', type: 'text' }],
        });

        await page.goto('/s/oauth-hq/connections');
        await row.click();
        await expect(page.getByText('echo', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reconnect' })).toBeVisible();

        const reconnectPopupPromise = page.waitForEvent('popup');
        await page.getByRole('button', { name: 'Reconnect' }).click();
        const reconnectPopup = await reconnectPopupPromise;
        await reconnectPopup.getByRole('button', { name: 'Allow' }).click();
        await expect(
            reconnectPopup.getByRole('heading', { name: 'Connection complete' })
        ).toBeVisible();
        await expect(page.getByText('echo', { exact: true })).toBeVisible();
        expect(provider.registrations()).toBe(2);
        expect(approved.computerId).toMatch(/^cmp_/u);
    } finally {
        socket?.close();
        provider.stop();
        await runtime?.close();
        await rm(root, { force: true, recursive: true });
    }
});

async function connectComputer(credential: string, runtime: AttachmentMcpRuntime) {
    const socket = new WebSocket(
        `ws://127.0.0.1:${process.env.GROTTO_SERVER_PORT}/computer/attachment`
    );
    await new Promise<void>((resolve, reject) => {
        socket.on('error', reject);
        socket.on('close', (code, reason) => {
            reject(new Error(`Attachment socket closed ${code}: ${reason.toString()}`));
        });
        socket.on('open', () => {
            socket.send(
                JSON.stringify({
                    architecture: 'arm64',
                    credential,
                    health: 'healthy',
                    inventory: {
                        runtimes: [
                            {
                                id: 'controlled-runtime',
                                label: 'Controlled Runtime',
                                models: [{ id: 'controlled-model', label: 'Controlled Model' }],
                            },
                        ],
                    },
                    operatingSystem: 'macOS',
                    productVersion: '1.0.0',
                    protocolVersion: 1,
                    type: 'hello',
                })
            );
        });
        socket.on('message', (event) => {
            const frame = JSON.parse(event.toString()) as Record<string, unknown>;
            if (frame.type === 'accepted') {
                resolve();
                return;
            }
            if (frame.type === 'mcp-upsert') {
                const connection = frame.connection as Parameters<typeof runtime.upsert>[0];
                void runtime.upsert(connection).then(async () => {
                    socket.send(
                        JSON.stringify({
                            accountLabel: null,
                            connected: await runtime.isConnected(connection.id),
                            connectionId: connection.id,
                            tools: [],
                            type: 'mcp-inventory',
                        })
                    );
                });
                return;
            }
            if (frame.type === 'mcp-oauth-start') {
                void runtime
                    .startOAuth({
                        allowAuthorizationServerOrigin: Boolean(
                            frame.allowAuthorizationServerOrigin
                        ),
                        connectionId: String(frame.connectionId),
                        redirectUrl: String(frame.redirectUrl),
                        routingState: String(frame.routingState),
                    })
                    .then((result) =>
                        socket.send(
                            JSON.stringify({
                                requestId: frame.requestId,
                                result,
                                type: 'mcp-oauth-started',
                            })
                        )
                    );
                return;
            }
            if (frame.type === 'mcp-oauth-complete') {
                void runtime
                    .completeOAuth({
                        code: String(frame.code),
                        connectionId: String(frame.connectionId),
                        redirectUrl: String(frame.redirectUrl),
                        state: String(frame.state),
                    })
                    .then((discovery) => {
                        socket.send(
                            JSON.stringify({
                                accountLabel: discovery.accountLabel,
                                connected: true,
                                connectionId: frame.connectionId,
                                tools: discovery.tools,
                                type: 'mcp-inventory',
                            })
                        );
                        socket.send(
                            JSON.stringify({
                                requestId: frame.requestId,
                                type: 'mcp-oauth-completed',
                            })
                        );
                    });
                return;
            }
            if (frame.type === 'mcp-grant') {
                const grant = frame.grant as Record<string, unknown>;
                runtime.setGrant({
                    agentId: String(grant.agentId),
                    connectionId: String(grant.connectionId),
                    enabled: Boolean(grant.enabled),
                    toolName: String(grant.toolName),
                });
            }
        });
    });
    return socket;
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
