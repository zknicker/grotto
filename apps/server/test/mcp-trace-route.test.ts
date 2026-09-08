import { afterAll, beforeAll, expect, test } from 'bun:test';
import { makeTelemetryLayer } from '@grotto/effect';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ManagedRuntime } from 'effect';
import Fastify from 'fastify';
import { registerAgentMcpRoutes } from '../src/agent-api/mcp-routes.ts';
import { connectGrottoDatabase, type GrottoConnection } from '../src/postgres/connection.ts';
import { McpRuntime } from '../src/server-mcp/runtime.ts';
import { makeClient } from '../src/server-mcp/runtime-test-fixtures.ts';
import { modelToolName } from '../src/server-mcp/tool-catalog.ts';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

const exporter = new InMemorySpanExporter();
const effectRuntime = ManagedRuntime.make(
    makeTelemetryLayer({
        serviceName: 'grotto-test',
        spanProcessor: new SimpleSpanProcessor(exporter),
    })
);
const app = Fastify();
const computerId = `cmp_${'t'.repeat(16)}`;
const connectionId = `mcp_${'t'.repeat(16)}`;
const credentialHash = 'c'.repeat(64);
const traceId = 'a'.repeat(32);
const parentId = 'b'.repeat(16);
let harness: GrottoServerHarness;
let owner: GrottoClient;
let connection: GrottoConnection;
let runtime: McpRuntime;
let runnerToken: string;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    const token = await harness.clerk.mintSessionToken('user_mcp_trace');
    owner = createGrottoClient(harness, token);
    const server = await owner.trpc.server.create.mutate({ displayName: 'Trace', slug: 'trace' });
    const [user] = await harness.sql`select id from users where clerk_user_id = 'user_mcp_trace'`;
    await harness.sql`insert into computers (id, server_id, attached_by_user_id, credential_hash, reported_inventory, health)
        values (${computerId}, ${server.id}, ${user.id}, ${credentialHash},
        ${{ runtimes: [{ id: 'codex', label: 'Codex', models: [{ id: 'gpt-5.6-sol', label: 'Sol' }] }] }}::jsonb, 'healthy')`;
    const { agent } = await owner.trpc.agent.create.mutate({
        computerId,
        displayName: 'Trace Agent',
        handle: 'trace-agent',
        modelId: 'gpt-5.6-sol',
        role: 'member',
        runtimeId: 'codex',
        serverId: server.id,
    });
    const chat = await owner.trpc.chat.ensureAgentDm.mutate({
        agentId: agent.id,
        serverId: server.id,
    });
    const minted = await fetch(new URL('/computer/runner/mint', harness.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            agentId: agent.id,
            chatId: chat.id,
            credentialHash,
            runId: 'trace-route',
        }),
    });
    expect(minted.status).toBe(200);
    ({ runnerToken } = await minted.json());
    await harness.sql`insert into mcp_connections (id, server_id, name, url, auth, connected, header_names, tools)
        values (${connectionId}, ${server.id}, 'Fixture', 'https://example.test/mcp', 'none', true, '{}'::text[], ARRAY['echo'])`;
    await harness.sql`insert into agent_mcp_connection_grants (server_id, agent_id, connection_id)
        values (${server.id}, ${agent.id}, ${connectionId})`;
    connection = await connectGrottoDatabase(harness.databaseUrl);
    runtime = new McpRuntime(connection.db, effectRuntime, {
        clientFactory: async () => makeClient('Fixture').client,
    });
    registerAgentMcpRoutes(app, { db: connection.db, runtime });
});

afterAll(async () => {
    await app.close();
    await runtime?.close();
    await effectRuntime.dispose();
    await connection?.close();
    owner?.close();
    await harness?.close();
});

test('authenticated MCP discovery and invocation continue valid context; malformed context never changes the operation or exports secrets', async () => {
    const valid = `00-${traceId}-${parentId}-01`;
    for (const traceparent of [
        valid,
        'invalid-private-context',
        `00-${'0'.repeat(32)}-${parentId}-01`,
    ]) {
        exporter.reset();
        const headers = { authorization: `Bearer ${runnerToken}`, traceparent };
        const discovery = await app.inject({ url: '/api/agent/mcp/tools', headers });
        expect(discovery.statusCode).toBe(200);
        const invocation = await app.inject({
            url: '/api/agent/mcp/invoke',
            method: 'POST',
            headers,
            payload: {
                toolName: modelToolName(connectionId, 'echo'),
                args: { secret: 'private-request-payload' },
            },
        });
        expect(invocation.statusCode).toBe(200);
        const spans = exporter.getFinishedSpans();
        expect(spans).toHaveLength(2);
        for (const span of spans) {
            expect(span.name).toBe('grotto.mcp.operation');
            if (traceparent === valid) {
                expect(span.spanContext().traceId).toBe(traceId);
                expect(span.parentSpanContext?.spanId).toBe(parentId);
            } else {
                expect(span.parentSpanContext).toBeUndefined();
            }
            const exported = JSON.stringify({
                attributes: span.attributes,
                events: span.events,
                status: span.status,
            });
            expect(exported).not.toContain(runnerToken);
            expect(exported).not.toContain('private-request-payload');
            expect(exported).not.toContain('invalid-private-context');
        }
    }
    exporter.reset();
    const rejected = await app.inject({
        url: '/api/agent/mcp/tools',
        headers: { authorization: 'Bearer wrong', traceparent: valid },
    });
    expect(rejected.statusCode).toBe(401);
    expect(exporter.getFinishedSpans()).toHaveLength(0);
});
