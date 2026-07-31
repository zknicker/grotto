import {
    agentRuntimeAgentActivityListSchema,
    agentRuntimeAgentPresenceListSchema,
    agentRuntimeCurrentAgentSessionResultSchema,
    agentRuntimeMacAppListSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeResetAgentSessionResultSchema,
    agentRuntimeResetAgentSessionSchema,
    agentRuntimeRoutes,
    agentRuntimeSkillResetResultSchema,
    agentRuntimeUpdateRequestSchema,
    agentRuntimeUpdateSchema,
    runtimeEventListSchema,
    runtimeHealthSchema,
    runtimeRoutes,
} from '@tavern/api';
import { handleAgentEnvRequest } from '../agent-engine/agent-env-routes.ts';
import { handleMcpRequest } from '../agent-engine/mcp-routes.ts';
import { handleSkillHubRequest } from '../agent-engine/skill-hub-routes.ts';
import { resetRuntimeSkillToDefault } from '../agent-engine/skill-library.ts';
import { handleToolSetupRequest } from '../agent-engine/tool-setup-routes.ts';
import { handleBrowserRequest } from '../browser/routes.ts';
import { handleRuntimeCapabilitiesRequest } from '../capabilities/routes.ts';
import type { RuntimeRequestAuth } from '../identity/auth.ts';
import { handleIdentityRequest } from '../identity/routes.ts';
import { handleRuntimeJobsRequest } from '../jobs/routes.ts';
import { listMacApps } from '../mac-apps/inventory.ts';
import { handleModelAccessRequest } from '../model-access/model-access.ts';
import { handleOpenAiSettingsRequest } from '../model-access/openai-settings.ts';
import { handleOpenRouterSettingsRequest } from '../model-access/openrouter-settings.ts';
import { handleModelCapabilitySelectionsRequest } from '../models/capability-selections.ts';
import { handleModelCategorySettingsRequest } from '../models/category-settings.ts';
import { handleModelProviderRequest } from '../models/provider-routes.ts';
import { handleChatPaneRequest } from '../pane/routes.ts';
import { handleTimezoneSettingsRequest } from '../timezone-settings.ts';
import { handleWorkspaceRequest } from '../workspace/routes.ts';
import { listAgentActivity } from './agent-activity.ts';
import { handleAgentApiRequest } from './agent-api-router.ts';
import { agentSessionInstructionsFresh } from './agent-instructions.ts';
import { listAgentPresence } from './agent-presence.ts';
import { resetAgentSession } from './agent-session-reset.ts';
import { readAgentSessionStats, readPastAgentSessionSummaries } from './agent-session-stats.ts';
import { readCurrentAgentSession } from './agent-session-store.ts';
import { getChat } from './chat-api/index.ts';

import { handleTavernApiRequest } from './chat-api-router.ts';
import { badRequest, forbidden, json, notFound, readJson } from './http.ts';
import { handleAgentProxyRequest } from './proxy.ts';
import { listProjectedTavernRuntimeEvents } from './runtime-event-projection.ts';
import { getRuntimeHealth } from './status.ts';
import { getRuntimeUpdateStatus, restartRuntimeForUpdate, startRuntimeUpdate } from './update.ts';

export async function handleTavernRuntimeRequest(
    request: Request,
    auth: RuntimeRequestAuth = { kind: 'runtime-token' }
): Promise<Response> {
    const url = new URL(request.url);
    if (auth.kind === 'agent-token') {
        return (await handleAgentApiRequest(request, auth.agentId)) ?? notFound();
    }
    const identityResponse = await handleIdentityRequest(request, auth);
    if (identityResponse) {
        return identityResponse;
    }
    const apiResponse = await handleTavernApiRequest(request);
    if (apiResponse) {
        return apiResponse;
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.macApps) {
        return json(
            agentRuntimeMacAppListSchema.parse({
                apps: await listMacApps({
                    limit: Number(url.searchParams.get('limit') ?? 80),
                    query: url.searchParams.get('query') ?? '',
                }),
            })
        );
    }

    const jobsResponse = await handleRuntimeJobsRequest(request);
    if (jobsResponse) {
        return jobsResponse;
    }

    const chatPaneResponse = await handleChatPaneRequest(request);
    if (chatPaneResponse) {
        return chatPaneResponse;
    }

    const modelProviderResponse = await handleModelProviderRequest(request);
    if (modelProviderResponse) {
        return modelProviderResponse;
    }

    const modelAccessResponse = await handleModelAccessRequest(request);
    if (modelAccessResponse) {
        return modelAccessResponse;
    }

    const modelCategorySettingsResponse = await handleModelCategorySettingsRequest(request);
    if (modelCategorySettingsResponse) {
        return modelCategorySettingsResponse;
    }

    const modelCapabilitySelectionsResponse = await handleModelCapabilitySelectionsRequest(request);
    if (modelCapabilitySelectionsResponse) {
        return modelCapabilitySelectionsResponse;
    }

    const openAiSettingsResponse = await handleOpenAiSettingsRequest(request);
    if (openAiSettingsResponse) {
        return openAiSettingsResponse;
    }

    const openRouterSettingsResponse = await handleOpenRouterSettingsRequest(request);
    if (openRouterSettingsResponse) {
        return openRouterSettingsResponse;
    }

    const timezoneSettingsResponse = await handleTimezoneSettingsRequest(request);
    if (timezoneSettingsResponse) {
        return timezoneSettingsResponse;
    }

    const agentEnvResponse = await handleAgentEnvRequest(request);
    if (agentEnvResponse) {
        return agentEnvResponse;
    }

    const browserResponse = await handleBrowserRequest(request);
    if (browserResponse) {
        return browserResponse;
    }

    const skillHubResponse = await handleSkillHubRequest(request);
    if (skillHubResponse) {
        return skillHubResponse;
    }

    const toolSetupResponse = await handleToolSetupRequest(request);
    if (toolSetupResponse) {
        return toolSetupResponse;
    }

    const mcpResponse = await handleMcpRequest(request);
    if (mcpResponse) {
        return mcpResponse;
    }

    const capabilitiesResponse = await handleRuntimeCapabilitiesRequest(request);
    if (capabilitiesResponse) {
        return capabilitiesResponse;
    }

    const workspaceResponse = await handleWorkspaceRequest(request);
    if (workspaceResponse) {
        return workspaceResponse;
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.health) {
        return json(runtimeHealthSchema.parse(getRuntimeHealth()));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.update) {
        if (
            request.headers.get(agentRuntimeMutationHeaders.origin) !==
            agentRuntimeMutationOrigins.tavern
        ) {
            return forbidden('Runtime update requires a Grotto caller.');
        }
        return json(
            agentRuntimeUpdateSchema.parse(
                startRuntimeUpdate(agentRuntimeUpdateRequestSchema.parse(await readJson(request)))
            )
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.updateStatus) {
        return json(agentRuntimeUpdateSchema.parse(getRuntimeUpdateStatus()));
    }

    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.updateRestart) {
        if (
            request.headers.get(agentRuntimeMutationHeaders.origin) !==
            agentRuntimeMutationOrigins.tavern
        ) {
            return forbidden('Runtime restart requires a Grotto caller.');
        }
        return json(agentRuntimeUpdateSchema.parse(restartRuntimeForUpdate()));
    }

    if (request.method === 'GET' && url.pathname === runtimeRoutes.events) {
        const limit = Number(url.searchParams.get('limit') ?? 500);
        const afterCursor = Number(url.searchParams.get('after_cursor') ?? 0);
        return json(
            runtimeEventListSchema.parse({
                events: listProjectedTavernRuntimeEvents({
                    afterCursor: Number.isFinite(afterCursor) ? afterCursor : 0,
                    limit: Number.isFinite(limit) ? limit : 500,
                }).map((entry) => entry.event),
            })
        );
    }

    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (
        request.method === 'GET' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'activity'
    ) {
        const limitParam = url.searchParams.get('limit');
        return json(
            agentRuntimeAgentActivityListSchema.parse({
                entries: listAgentActivity({
                    agentId: segments[1],
                    ...(limitParam ? { limit: Number(limitParam) } : {}),
                }),
            })
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.agentPresence) {
        return json(agentRuntimeAgentPresenceListSchema.parse({ presence: listAgentPresence() }));
    }

    if (
        request.method === 'POST' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'session' &&
        segments[3] === 'reset'
    ) {
        const input = agentRuntimeResetAgentSessionSchema.parse(await readJson(request));
        return json(
            agentRuntimeResetAgentSessionResultSchema.parse(
                await resetAgentSession({
                    agentId: segments[1],
                    kind: input.kind,
                })
            )
        );
    }

    if (
        request.method === 'GET' &&
        segments[0] === 'agent' &&
        segments[1] === 'chats' &&
        segments[2] &&
        segments[3] === 'agent-sessions' &&
        segments[4] === 'current'
    ) {
        // Sessions are agent-global; the chat path segment only helps the
        // app resolve which agent's session to show. Clients pass agentId
        // explicitly, or the chat's single agent seat resolves it.
        const agentId = url.searchParams.get('agentId') ?? resolveChatAgentId(segments[2]);
        if (!agentId) {
            return notFound();
        }
        const session = readCurrentAgentSession({ agentId });
        return json(
            agentRuntimeCurrentAgentSessionResultSchema.parse({
                instructionsFresh: session ? await agentSessionInstructionsFresh(session) : null,
                pastSessions: readPastAgentSessionSummaries({
                    agentId,
                    currentSessionId: session?.id ?? null,
                }),
                session,
                stats: session ? readAgentSessionStats({ sessionId: session.id }) : null,
            })
        );
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.agents) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.chats) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.models) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.skills) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && segments[0] === 'skills' && segments[1] && !segments[2]) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (
        request.method === 'POST' &&
        segments[0] === 'skills' &&
        segments[1] &&
        segments[2] === 'reset'
    ) {
        try {
            const result = await resetRuntimeSkillToDefault(segments[1]);
            return json(agentRuntimeSkillResetResultSchema.parse(result));
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
    }

    if (
        request.method === 'PUT' &&
        segments[0] === 'skills' &&
        segments[1] &&
        segments[2] === 'enabled'
    ) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessions) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.sessionPreviews) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (
        request.method === 'GET' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'config'
    ) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (
        request.method === 'GET' &&
        segments[0] === 'skills' &&
        segments[1] &&
        segments[2] === 'config'
    ) {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    const agentSessionKey =
        segments[0] === 'agent' && segments[1] === 'sessions' ? segments[2] : null;
    if (agentSessionKey && request.method === 'GET' && segments[3] === 'messages') {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (agentSessionKey && request.method === 'GET' && segments[3] === 'graph') {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    if (agentSessionKey && request.method === 'POST' && segments[3] === 'resync') {
        const response = await handleAgentProxyRequest(request);
        return response ?? notFound();
    }

    const proxyResponse = await handleAgentProxyRequest(request);

    return proxyResponse ?? notFound();
}

// The chat's single agent seat, when unambiguous. Sessions are agent-global
// (specs/sessions.md); this only resolves which agent a chat-scoped session
// view is about.
function resolveChatAgentId(chatId: string) {
    const agents = (getChat(chatId)?.participants ?? []).filter(
        (participant) => participant.kind === 'agent'
    );
    if (agents.length !== 1) {
        return null;
    }
    const participant = agents[0];
    if (!participant) {
        return null;
    }
    const agentId = (participant.metadata as Record<string, unknown>).agentId;
    return typeof agentId === 'string' && agentId.length > 0 ? agentId : participant.id;
}
