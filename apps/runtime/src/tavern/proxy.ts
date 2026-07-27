import {
    type AgentRuntimeAgent,
    agentRuntimeAgentInboxSchema,
    agentRuntimeAgentStopResultSchema,
    agentRuntimeArchiveAgentSchema,
    agentRuntimeCreateAgentSchema,
    agentRuntimeRestartAgentResultSchema,
    agentRuntimeRoutes,
    agentRuntimeSkillListSchema,
    agentRuntimeSkillSchema,
    agentRuntimeStopTurnResultSchema,
    agentRuntimeUpdateAgentBioSchema,
    agentRuntimeUpdateAgentModelSchema,
    agentRuntimeUpdateAgentNameSchema,
    agentRuntimeUpdateAgentThinkingDefaultSchema,
    agentRuntimeUpdateAgentWebSettingsSchema,
    agentRuntimeUpdateSkillEnabledSchema,
    agentRuntimeUpdateToolEnabledSchema,
} from '@tavern/api';
import { ZodError } from 'zod';
import { closeMcpClientsForAgent } from '../agent-engine/mcp-clients.ts';
import {
    getRuntimeSkill,
    listRuntimeSkills,
    setRuntimeSkillEnabled,
} from '../agent-engine/skill-library.ts';
import { runRuntimeDoctor } from '../doctor/runtime-doctor.ts';
import { listAgentModels } from '../models/catalog-service.ts';
import {
    resolveAgentModelSelection,
    saveAgentModelSelectionIntent,
} from '../models/selection-service.ts';
import { createRuntimeAgent } from './agent-create.ts';
import { readAgentInboxVisibility } from './agent-inbox-api.ts';
import { restartAgent, stopAgentTurn, stopAgentTurns } from './agent-turn-runner.ts';
import {
    deleteStoredAgent,
    getStoredAgent,
    listStoredAgents,
    updateStoredAgent,
} from './agents-store.ts';
import { HandleValidationError } from './handles.ts';
import { badRequest, json } from './http.ts';
import { getRuntimeTool, listRuntimeTools } from './tool-catalog.ts';

export async function handleAgentProxyRequest(request: Request): Promise<Response | null> {
    try {
        const url = new URL(request.url);
        const payload = await dispatchAgentEngineStatic({ request, url });
        return payload === undefined ? null : json(payload);
    } catch (error) {
        if (error instanceof HandleValidationError || error instanceof ZodError) {
            return badRequest(error.message);
        }
        throw error;
    }
}

async function dispatchAgentEngineStatic({ request, url }: { request: Request; url: URL }) {
    const method = request.method;
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (method === 'GET' && url.pathname === agentRuntimeRoutes.agents) {
        return withResolvedModelNames(listStoredAgents());
    }
    if (method === 'POST' && url.pathname === agentRuntimeRoutes.agents) {
        const input = agentRuntimeCreateAgentSchema.parse(await readJson(request));
        const agent = await createRuntimeAgent(input);
        await runRuntimeDoctor({
            modules: ['agents'],
            reason: 'agent_changed',
            scope: { kind: 'agent', agentId: agent.id },
        });
        return withResolvedModelName(agent);
    }
    if (method === 'DELETE' && segments[0] === 'agents' && segments[1] && !segments[2]) {
        await closeMcpClientsForAgent(segments[1]);
        deleteStoredAgent(segments[1]);
        return agentRuntimeArchiveAgentSchema.parse({
            archived: true,
            id: segments[1],
        });
    }
    if (method === 'GET' && segments[0] === 'agents' && segments[1] && segments[2] === 'config') {
        const agent = getStoredAgent(segments[1]);
        return agent ? withResolvedModelName(agent) : undefined;
    }
    if (
        method === 'PATCH' &&
        segments[0] === 'agents' &&
        segments[1] &&
        segments[2] === 'web-settings' &&
        !segments[3]
    ) {
        const payload = agentRuntimeUpdateAgentWebSettingsSchema.parse(await readJson(request));
        const updatedAgent = updateStoredAgent({
            agentId: segments[1],
            webAccessEnabled: payload.webAccessEnabled,
        });
        return updatedAgent ? withResolvedModelName(updatedAgent) : undefined;
    }
    if (
        method === 'PATCH' &&
        segments[0] === 'agents' &&
        segments[1] &&
        ['bio', 'model', 'name', 'thinking-default'].includes(segments[2] ?? '')
    ) {
        const input = await readJson(request);
        const agentId = segments[1];
        let updatedAgent: AgentRuntimeAgent | null = null;
        if (segments[2] === 'model') {
            updatedAgent = await savePatchedModel(agentId, input);
        } else if (segments[2] === 'bio') {
            const payload = agentRuntimeUpdateAgentBioSchema.parse(input);
            updatedAgent = updateStoredAgent({ agentId, bio: payload.bio });
        } else if (segments[2] === 'name') {
            const payload = agentRuntimeUpdateAgentNameSchema.parse(input);
            updatedAgent = updateStoredAgent({ agentId, name: payload.name });
        } else if (segments[2] === 'thinking-default') {
            const payload = agentRuntimeUpdateAgentThinkingDefaultSchema.parse(input);
            updatedAgent = updateStoredAgent({
                agentId,
                thinkingDefault: payload.thinkingDefault,
            });
        }
        if (!updatedAgent) {
            return undefined;
        }
        return agentEngineAgentConfigSnapshot();
    }
    if (method === 'POST' && segments[0] === 'agents' && segments[1] && segments[2] === 'stop') {
        const agentId = segments[1];
        const stopped = await stopAgentTurns(agentId);
        return agentRuntimeAgentStopResultSchema.parse({ agentId, stopped });
    }
    if (method === 'POST' && segments[0] === 'agents' && segments[1] && segments[2] === 'restart') {
        const { session, stopped } = await restartAgent(segments[1]);
        return agentRuntimeRestartAgentResultSchema.parse({ session, stopped });
    }
    if (method === 'GET' && segments[0] === 'agents' && segments[1] && segments[2] === 'inbox') {
        return agentRuntimeAgentInboxSchema.parse(readAgentInboxVisibility(segments[1]));
    }
    // The managed agent-file surface (NOTES.md / SOUL.md editors) retired
    // with the flip: notes injection died with D3 and SOUL with ruling W2.
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.models) {
        return await listAgentModels();
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.skills) {
        const agentId = url.searchParams.get('agentId');
        const agent = agentId ? getStoredAgent(agentId) : null;
        if (agentId && !agent) {
            return agentRuntimeSkillListSchema.parse({ skills: [] });
        }
        return agentRuntimeSkillListSchema.parse({
            skills: await listRuntimeSkills({ agent }),
        });
    }
    if (method === 'GET' && segments[0] === 'skills' && segments[1] && !segments[2]) {
        const skill = await getRuntimeSkill(segments[1]);
        return skill ? agentRuntimeSkillSchema.parse(skill) : undefined;
    }
    if (method === 'PUT' && segments[0] === 'skills' && segments[1] && segments[2] === 'enabled') {
        const input = agentRuntimeUpdateSkillEnabledSchema.parse(await readJson(request));
        setRuntimeSkillEnabled(segments[1], input.enabled);
        const skill = await getRuntimeSkill(segments[1]);
        return skill ? agentRuntimeSkillSchema.parse(skill) : undefined;
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.tools) {
        return listRuntimeTools();
    }
    if (method === 'PUT' && segments[0] === 'tools' && segments[1] && segments[2] === 'enabled') {
        agentRuntimeUpdateToolEnabledSchema.parse(await readJson(request));
        return getRuntimeTool(segments[1]) ?? undefined;
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.sessions) {
        return { sessions: [] };
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.sessionPreviews) {
        return {
            previews: url.searchParams.getAll('key').map((key) => ({
                items: [],
                key,
                status: 'empty',
            })),
        };
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.chats) {
        return { chats: [] };
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.bindings) {
        return { bindings: [] };
    }
    if (method === 'GET' && url.pathname === agentRuntimeRoutes.discordBindings) {
        return { bindings: [] };
    }
    if (method === 'POST' && segments[0] === 'agent' && segments[1] === 'chats') {
        const chatId = segments[2];
        if (chatId && segments[3] === 'turns' && segments[4] && segments[5] === 'stop') {
            const runId = segments[4];
            const stopped = await stopAgentTurn(runId);
            return agentRuntimeStopTurnResultSchema.parse({ runId, stopped });
        }
    }
    return undefined;
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}

async function savePatchedModel(agentId: string, input: unknown) {
    const payload = agentRuntimeUpdateAgentModelSchema.parse(input);
    const agent = getStoredAgent(agentId);

    if (!agent) {
        return null;
    }
    const inventory = await listAgentModels();
    const executable = inventory.models.some(
        (model) =>
            model.provider === payload.model.provider &&
            model.route.model === payload.model.model &&
            model.availability === 'available'
    );
    if (!executable) {
        throw new Error(
            `Model "${payload.model.provider}/${payload.model.model}" is not executable.`
        );
    }

    saveAgentModelSelectionIntent({
        agentId,
        modelName: payload.model,
    });
    await runRuntimeDoctor({
        modules: ['agents'],
        reason: 'agent_changed',
        scope: { kind: 'agent', agentId },
    });

    return agent;
}

function withResolvedModelNames(input: ReturnType<typeof listStoredAgents>) {
    return {
        agents: input.agents.map(withResolvedModelName),
    };
}

function withResolvedModelName(agent: NonNullable<ReturnType<typeof getStoredAgent>>) {
    const model = resolveAgentModelSelection({ agentId: agent.id });
    return {
        ...agent,
        modelName: {
            model: model.model,
            provider: model.provider,
        },
        thinkingDefault: agent.thinkingDefault ?? null,
    };
}

function agentConfigEntry(agent: ReturnType<typeof withResolvedModelName>) {
    return {
        id: agent.id,
        model: agent.modelName,
        name: agent.name,
        thinkingDefault: agent.thinkingDefault,
    };
}

function agentConfigHash(agents: ReturnType<typeof withResolvedModelName>[]) {
    return `agent-engine:${agents
        .map((agent) => `${agent.id}:${agent.modelName.provider}/${agent.modelName.model}`)
        .join(',')}`;
}

function agentEngineAgentConfigSnapshot() {
    const agents = listStoredAgents().agents.map(withResolvedModelName);

    return {
        config: {
            agents: {
                list: agents.map(agentConfigEntry),
            },
        },
        hash: agentConfigHash(agents),
        issues: [],
        raw: null,
        valid: true,
    };
}
