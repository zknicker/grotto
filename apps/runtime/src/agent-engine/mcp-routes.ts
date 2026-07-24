import {
    agentRuntimeHostToolGrantUpdateSchema,
    agentRuntimeHostToolIdSchema,
    agentRuntimeHostToolListSchema,
    agentRuntimeMcpAgentToolGrantListSchema,
    agentRuntimeMcpAgentToolGrantUpdateSchema,
    agentRuntimeMcpConnectionCreateSchema,
    agentRuntimeMcpConnectionListSchema,
    agentRuntimeMcpConnectionSchema,
    agentRuntimeMcpConnectionTestResultSchema,
    agentRuntimeMcpConnectionUpdateSchema,
    agentRuntimeMcpDisconnectResultSchema,
    agentRuntimeMcpOAuthCompleteSchema,
    agentRuntimeMcpOAuthStartResultSchema,
    agentRuntimeMcpOAuthStartSchema,
    agentRuntimeMcpPresetAccountCreateSchema,
    agentRuntimeMcpToolListSchema,
} from '@tavern/api';
import { badRequest, json, notFound } from '../tavern/http.ts';
import { listAgentHostTools, setAgentHostToolGrant } from './host-tools.ts';
import {
    closeMcpClientsForConnection,
    listLiveMcpTools,
    testMcpConnection,
} from './mcp-clients.ts';
import {
    createMcpConnection,
    createPresetMcpConnection,
    deleteMcpConnection,
    disconnectMcpConnection,
    getMcpConnection,
    listAgentMcpToolGrants,
    listMcpConnections,
    setAgentMcpToolGrant,
    updateMcpConnection,
} from './mcp-connections.ts';
import { completeMcpOAuth, startMcpOAuth } from './mcp-oauth.ts';

export async function handleMcpRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== 'mcp') {
        return null;
    }

    try {
        return await routeMcpRequest(request, segments);
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }
}

async function routeMcpRequest(request: Request, segments: string[]) {
    if (segments[1] === 'connections') {
        return await routeConnectionRequest(request, segments);
    }
    if (segments[1] === 'preset-accounts' && request.method === 'POST' && !segments[2]) {
        const input = agentRuntimeMcpPresetAccountCreateSchema.parse(await readJson(request));
        return json(agentRuntimeMcpConnectionSchema.parse(createPresetMcpConnection(input)));
    }
    if (
        segments[1] === 'agents' &&
        segments[2] &&
        request.method === 'GET' &&
        segments[3] === 'grants'
    ) {
        return json(
            agentRuntimeMcpAgentToolGrantListSchema.parse({
                grants: listAgentMcpToolGrants(segments[2]),
            })
        );
    }
    if (
        segments[1] === 'agents' &&
        segments[2] &&
        segments[3] === 'host-tools' &&
        !segments[4] &&
        request.method === 'GET'
    ) {
        return json(
            agentRuntimeHostToolListSchema.parse({
                tools: listAgentHostTools(segments[2]),
            })
        );
    }
    if (
        segments[1] === 'agents' &&
        segments[2] &&
        segments[3] === 'host-tools' &&
        segments[4] &&
        segments[5] === 'grant' &&
        request.method === 'PUT'
    ) {
        const toolId = agentRuntimeHostToolIdSchema.parse(segments[4]);
        const input = agentRuntimeHostToolGrantUpdateSchema.parse(await readJson(request));
        setAgentHostToolGrant(segments[2], toolId, input.enabled);
        return json({ enabled: input.enabled, toolId });
    }
    if (
        segments[1] === 'agents' &&
        segments[2] &&
        segments[3] === 'connections' &&
        segments[4] &&
        segments[5] === 'tools' &&
        segments[6] &&
        segments[7] === 'grant' &&
        request.method === 'PUT'
    ) {
        const input = agentRuntimeMcpAgentToolGrantUpdateSchema.parse(await readJson(request));
        setAgentMcpToolGrant({
            agentId: segments[2],
            connectionId: segments[4],
            enabled: input.enabled,
            toolName: segments[6],
        });
        await closeMcpClientsForConnection(segments[4]);
        return json({
            agentId: segments[2],
            connectionId: segments[4],
            enabled: input.enabled,
            toolName: segments[6],
        });
    }
    return null;
}

async function routeConnectionRequest(request: Request, segments: string[]) {
    const connectionId = segments[2];
    const action = segments[3];
    if (request.method === 'GET' && !connectionId) {
        return json(
            agentRuntimeMcpConnectionListSchema.parse({
                connections: listMcpConnections(),
            })
        );
    }
    if (request.method === 'POST' && !connectionId) {
        const input = agentRuntimeMcpConnectionCreateSchema.parse(await readJson(request));
        return json(agentRuntimeMcpConnectionSchema.parse(createMcpConnection(input)));
    }
    if (!(connectionId && getMcpConnection(connectionId))) {
        return notFound();
    }
    if (request.method === 'PATCH' && !action) {
        const input = agentRuntimeMcpConnectionUpdateSchema.parse(await readJson(request));
        const connection = updateMcpConnection(connectionId, input);
        await closeMcpClientsForConnection(connectionId);
        return connection ? json(agentRuntimeMcpConnectionSchema.parse(connection)) : notFound();
    }
    if (request.method === 'DELETE' && !action) {
        await closeMcpClientsForConnection(connectionId);
        const affectedAgents = deleteMcpConnection(connectionId);
        return json(
            agentRuntimeMcpDisconnectResultSchema.parse({
                affectedAgents: affectedAgents ?? [],
                ok: affectedAgents !== null,
            })
        );
    }
    if (request.method === 'POST' && action === 'disconnect') {
        await closeMcpClientsForConnection(connectionId);
        const affectedAgents = disconnectMcpConnection(connectionId);
        return json(
            agentRuntimeMcpDisconnectResultSchema.parse({
                affectedAgents,
                ok: true,
            })
        );
    }
    if (request.method === 'POST' && action === 'test') {
        return json(
            agentRuntimeMcpConnectionTestResultSchema.parse(await testMcpConnection(connectionId))
        );
    }
    if (request.method === 'POST' && action === 'refresh') {
        await closeMcpClientsForConnection(connectionId);
        return json(
            agentRuntimeMcpToolListSchema.parse({
                tools: await listLiveMcpTools(connectionId),
            })
        );
    }
    if (request.method === 'GET' && action === 'tools') {
        return json(
            agentRuntimeMcpToolListSchema.parse({
                tools: await listLiveMcpTools(connectionId),
            })
        );
    }
    if (request.method === 'POST' && action === 'oauth' && segments[4] === 'start') {
        const input = agentRuntimeMcpOAuthStartSchema.parse(await readJson(request));
        return json(
            agentRuntimeMcpOAuthStartResultSchema.parse(
                await startMcpOAuth(connectionId, input, async () => {
                    await closeMcpClientsForConnection(connectionId);
                })
            )
        );
    }
    if (request.method === 'POST' && action === 'oauth' && segments[4] === 'complete') {
        const input = agentRuntimeMcpOAuthCompleteSchema.parse(await readJson(request));
        await completeMcpOAuth(connectionId, input);
        await closeMcpClientsForConnection(connectionId);
        return json(agentRuntimeMcpConnectionSchema.parse(getMcpConnection(connectionId)?.api));
    }
    return null;
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}
