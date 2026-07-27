import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Attachment, type HostedAgentStartCommand, runAgentLaunch } from './launch.ts';
import { AttachmentMcpRuntime } from './mcp-runtime.ts';

type FakeServer = ReturnType<typeof Bun.serve>;

const runnerToken = `grtr_${'a'.repeat(43)}`;

interface FakeServerState {
    authHeaders: string[];
    mintCount: number;
    revokedRunnerId: string | null;
    sends: { content: string; nonce: string; target: string }[];
    server: FakeServer;
}

let state: FakeServerState;
let dataRoot: string;
const deterministicMcp = fileURLToPath(
    new URL('./test-fixtures/deterministic-mcp.ts', import.meta.url)
);

beforeEach(async () => {
    dataRoot = await mkdtemp(join(tmpdir(), 'grotto-launch-'));
    const server = Bun.serve({
        fetch: async (request) => {
            const url = new URL(request.url);
            if (url.pathname === '/computer/runner/mint') {
                state.mintCount += 1;
                return Response.json({ runnerId: 'arc_launchtest000000', runnerToken });
            }
            if (url.pathname === '/computer/runner/revoke') {
                state.revokedRunnerId = ((await request.json()) as { runnerId: string }).runnerId;
                return Response.json({ revoked: true });
            }
            if (url.pathname === '/api/agent/messages/send') {
                state.authHeaders.push(request.headers.get('authorization') ?? '');
                state.sends.push(
                    (await request.json()) as { content: string; nonce: string; target: string }
                );
                return Response.json({
                    receipt: {
                        chatId: 'cht_test',
                        idempotent: false,
                        messageId: 'msg_test',
                        sequence: 1,
                        target: 'dm:@operator',
                    },
                    state: 'sent',
                });
            }
            return new Response('not found', { status: 404 });
        },
        hostname: '127.0.0.1',
        port: 0,
    });
    state = { authHeaders: [], mintCount: 0, revokedRunnerId: null, sends: [], server };
});

afterEach(async () => {
    state.server.stop(true);
    await rm(dataRoot, { force: true, recursive: true });
});

test('runs a deterministic Agent launch that lands a durable hosted message', async () => {
    const attachment: Attachment = {
        computerId: 'cmp_launchtest0000000',
        credential: 'launch-test-credential',
        serverOrigin: `http://127.0.0.1:${state.server.port}`,
        serverId: 'srv_launchtest',
        slug: 'launch-test',
    };
    const command: HostedAgentStartCommand = {
        agentId: 'agt_launchtest',
        chatId: 'cht_test',
        modelId: 'fake-model',
        prompt: [
            '--- New messages ---',
            '[target=dm type=human] ping the operator',
            '',
            'Reply.',
        ].join('\n'),
        runId: 'run_launchtest',
        runtimeId: 'fake',
        type: 'start',
    };
    const turnFrames: Record<string, unknown>[] = [];

    await runAgentLaunch({
        attachment,
        command,
        dataRoot,
        mcpRuntime: new AttachmentMcpRuntime(join(dataRoot, 'servers', 'srv_launchtest', 'mcp')),
        sendFrame: (frame) => turnFrames.push(frame as Record<string, unknown>),
        serverOrigin: `http://127.0.0.1:${state.server.port}`,
    });

    // The real managed CLI produced exactly one durable send with the
    // deterministic reply, targeting the collaboration channel.
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0]).toMatchObject({
        content: 'Acknowledged: ping the operator',
        target: 'dm:@operator',
    });
    expect(state.sends[0]?.nonce).toBeTruthy();

    // The Agent reached the Server only through the loopback proxy, which
    // swapped the local proxy token for the scoped runner credential.
    expect(state.authHeaders).toEqual([`Bearer ${runnerToken}`]);
    expect(state.mintCount).toBe(1);
    expect(state.revokedRunnerId).toBe('arc_launchtest000000');

    // One compact turn summary, no runner secret in it.
    expect(turnFrames).toHaveLength(1);
    expect(turnFrames[0]).toMatchObject({
        agentId: 'agt_launchtest',
        messageCount: 1,
        runId: 'run_launchtest',
        status: 'completed',
        type: 'turn',
    });
    expect(JSON.stringify(turnFrames[0])).not.toContain(runnerToken);

    // Isolated logical home/workspace/skills/runtime were created.
    const agentRoot = join(dataRoot, 'servers', attachment.serverId, 'agents', command.agentId);
    for (const dir of ['home', 'skills', 'workspace', 'runtime']) {
        expect((await stat(join(agentRoot, dir))).isDirectory()).toBe(true);
    }

    // The per-launch proxy token is swept at launch end; the raw trace stays
    // local and carries no runner secret.
    await expect(stat(join(agentRoot, 'runtime', 'proxy-token'))).rejects.toThrow();
    const trace = await readFile(join(agentRoot, 'runtime', `turn-${command.runId}.log`), 'utf8');
    expect(trace).not.toContain(runnerToken);
});

test('reports a failed turn when the runtime is not installed', async () => {
    const turnFrames: Record<string, unknown>[] = [];
    await runAgentLaunch({
        attachment: {
            computerId: 'cmp_launchtest0000000',
            credential: 'launch-test-credential',
            serverOrigin: `http://127.0.0.1:${state.server.port}`,
            serverId: 'srv_launchtest',
            slug: 'launch-test',
        },
        command: {
            agentId: 'agt_launchtest',
            chatId: 'cht_test',
            modelId: 'gpt',
            prompt: 'x',
            runId: 'run_missing',
            runtimeId: 'codex',
            type: 'start',
        },
        dataRoot,
        mcpRuntime: new AttachmentMcpRuntime(join(dataRoot, 'servers', 'srv_launchtest', 'mcp')),
        sendFrame: (frame) => turnFrames.push(frame as Record<string, unknown>),
        serverOrigin: `http://127.0.0.1:${state.server.port}`,
    });

    expect(state.mintCount).toBe(0);
    expect(turnFrames[0]).toMatchObject({ messageCount: 0, status: 'failed' });
});

test('the deterministic Agent invokes a granted MCP tool and cannot invoke it ungranted', async () => {
    const attachment: Attachment = {
        computerId: 'cmp_launchtest0000000',
        credential: 'launch-test-credential',
        serverOrigin: `http://127.0.0.1:${state.server.port}`,
        serverId: 'srv_launchtest',
        slug: 'launch-test',
    };
    const connectionId = 'mcp_1234567890123456';
    const mcpRuntime = new AttachmentMcpRuntime(
        join(dataRoot, 'servers', attachment.serverId, 'mcp')
    );
    await mcpRuntime.upsert({
        args: [deterministicMcp],
        auth: 'none',
        command: process.execPath,
        env: { MCP_PREFIX: 'agent' },
        headers: {},
        id: connectionId,
        name: 'Deterministic',
        oauthScopes: [],
        preset: null,
        url: null,
    });
    const base: HostedAgentStartCommand = {
        agentId: 'agt_launchtest',
        chatId: 'cht_test',
        modelId: 'fake-model',
        prompt: `[mcp=${connectionId}/echo] {"value":"granted"}`,
        runId: 'run_mcp_granted',
        runtimeId: 'fake',
        type: 'start',
    };
    mcpRuntime.replaceAgentGrants(base.agentId, [
        { agentId: base.agentId, connectionId, toolName: 'echo' },
    ]);
    const frames: Record<string, unknown>[] = [];
    await runAgentLaunch({
        attachment,
        command: base,
        dataRoot,
        mcpRuntime,
        sendFrame: (frame) => frames.push(frame as Record<string, unknown>),
        serverOrigin: `http://127.0.0.1:${state.server.port}`,
    });
    expect(state.sends.at(-1)?.content).toContain('agent:granted');
    expect(frames.at(-1)).toMatchObject({ status: 'completed' });

    mcpRuntime.replaceAgentGrants(base.agentId, []);
    await runAgentLaunch({
        attachment,
        command: { ...base, runId: 'run_mcp_ungranted' },
        dataRoot,
        mcpRuntime,
        sendFrame: (frame) => frames.push(frame as Record<string, unknown>),
        serverOrigin: `http://127.0.0.1:${state.server.port}`,
    });
    expect(state.sends).toHaveLength(1);
    expect(frames.at(-1)).toMatchObject({ status: 'failed' });
    await mcpRuntime.close();
});
