import { expect, test } from 'bun:test';
import { ComputerConnections } from '../src/computers/connections.ts';
import { HostedMcpOAuthRelay } from '../src/hosted-mcp/oauth-relay.ts';

const computerId = 'cmp_aaaaaaaaaaaaaaaa';
const otherComputerId = 'cmp_bbbbbbbbbbbbbbbb';
const connectionId = 'mcp_aaaaaaaaaaaaaaaa';
const redirectUrl = 'http://127.0.0.1:8091/mcp/oauth/callback';

test('relays one callback only to the attachment that started it', async () => {
    const frames: Record<string, unknown>[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(asFrame(frame)),
        serverId: 's',
        updatePhase: 'idle',
    });
    connections.register(otherComputerId, {
        ordinary: true,
        send: () => undefined,
        serverId: 's',
        updatePhase: 'idle',
    });
    const relay = new HostedMcpOAuthRelay(connections);

    const started = relay.start({
        allowAuthorizationServerOrigin: false,
        computerId,
        connectionId,
        redirectUrl,
    });
    await Promise.resolve();
    const startFrame = frames[0] ?? {};
    expect(
        connections.acceptMcpResponse(computerId, {
            requestId: String(startFrame.requestId),
            result: {
                authorizationUrl: `http://127.0.0.1/authorize?state=${startFrame.routingState}`,
                status: 'ready',
            },
            type: 'mcp-oauth-started',
        })
    ).toBe(true);
    await expect(started).resolves.toMatchObject({ status: 'ready' });

    const completed = relay.complete(String(startFrame.routingState), 'one-time-code');
    await Promise.resolve();
    const completeFrame = frames[1] ?? {};
    expect(completeFrame).toMatchObject({
        code: 'one-time-code',
        connectionId,
        state: startFrame.routingState,
        type: 'mcp-oauth-complete',
    });
    expect(
        connections.acceptMcpResponse(otherComputerId, {
            requestId: String(completeFrame.requestId),
            type: 'mcp-oauth-completed',
        })
    ).toBe(false);
    expect(
        connections.acceptMcpResponse(computerId, {
            requestId: String(completeFrame.requestId),
            type: 'mcp-oauth-completed',
        })
    ).toBe(true);
    await expect(completed).resolves.toEqual({ status: 'complete' });
    await expect(relay.complete(String(startFrame.routingState), 'replay')).resolves.toEqual({
        status: 'expired',
    });
});

test('expires routing state without forwarding a callback code', async () => {
    let now = 1000;
    const frames: Record<string, unknown>[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(asFrame(frame)),
        serverId: 's',
        updatePhase: 'idle',
    });
    const relay = new HostedMcpOAuthRelay(connections, () => now, 50);
    const started = relay.start({
        allowAuthorizationServerOrigin: false,
        computerId,
        connectionId,
        redirectUrl,
    });
    await Promise.resolve();
    const startFrame = frames[0] ?? {};
    connections.acceptMcpResponse(computerId, {
        requestId: String(startFrame.requestId),
        result: { authorizationUrl: 'http://127.0.0.1/authorize', status: 'ready' },
        type: 'mcp-oauth-started',
    });
    await started;
    now += 51;

    await expect(relay.complete(String(startFrame.routingState), 'secret-code')).resolves.toEqual({
        status: 'expired',
    });
    expect(frames).toHaveLength(1);
});

test('an offline attachment consumes the attempt and teaches retry', async () => {
    const frames: Record<string, unknown>[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(asFrame(frame)),
        serverId: 's',
        updatePhase: 'idle',
    });
    const relay = new HostedMcpOAuthRelay(connections);
    const started = relay.start({
        allowAuthorizationServerOrigin: false,
        computerId,
        connectionId,
        redirectUrl,
    });
    await Promise.resolve();
    const startFrame = frames[0] ?? {};
    connections.acceptMcpResponse(computerId, {
        requestId: String(startFrame.requestId),
        result: { authorizationUrl: 'http://127.0.0.1/authorize', status: 'ready' },
        type: 'mcp-oauth-started',
    });
    await started;
    connections.unregister(computerId);

    await expect(relay.complete(String(startFrame.routingState), 'secret-code')).resolves.toEqual({
        status: 'offline',
    });
    await expect(relay.complete(String(startFrame.routingState), 'replay')).resolves.toEqual({
        status: 'expired',
    });
});

function asFrame(value: unknown): Record<string, unknown> {
    return value as Record<string, unknown>;
}
