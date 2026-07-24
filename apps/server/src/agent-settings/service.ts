import { randomUUID } from 'node:crypto';
import type {
    AgentArchetypeId,
    AgentRuntimeSaveDiscordBinding,
    AgentRuntimeThinkingLevel,
    AgentRuntimeUpdateAgentWebSettings,
} from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import {
    createConfiguredAgentRuntimeClient,
    createConfiguredAgentRuntimeClientForRuntimeId,
    getCurrentConfiguredAgentRuntimeConnection,
} from '../agent-runtime/configured-client.ts';
import { getAgent, toAgentCatalogItem } from '../agents/catalog.ts';
import { emitAgentUpdated, emitModelUpdated } from '../api/invalidation-events.ts';
import { parseAgentModelRef } from '../model/model-mapping.ts';
import { saveAgentProfile } from '../storage/agent-profiles.ts';
import { syncAgentsForRuntime } from '../storage/agents.ts';
import { syncAgentWorkspaceInstructions } from '../sync/agent-runtime-sync.ts';

export async function createAgent(input: {
    archetype?: AgentArchetypeId;
    bio?: string;
    name: string;
    primaryColor?: null | string;
}) {
    const client = createConfiguredAgentRuntimeClient();
    const runtime = getCurrentConfiguredAgentRuntimeConnection();

    if (!(client && runtime?.enabled)) {
        throw new Error('No enabled Grotto Runtime connection exists.');
    }

    const id = createAgentId(input.name);

    try {
        // enabledSkillIds stays unset so the runtime seeds its defaults.
        const created = await client.upsertAgent({
            archetype: input.archetype,
            bio: input.bio,
            id,
            isAdmin: false,
            name: input.name,
            primaryColor: input.primaryColor ?? null,
        });
        await refreshAgentSnapshot({ client, runtimeId: runtime.id });
        // The onboarding guide wears the blob (ADR 0018); other archetypes
        // keep the id-derived default character.
        if (input.archetype === 'guide') {
            await saveAgentProfile({
                agentId: created.id,
                character: 'blob',
                runtimeId: runtime.id,
            });
        }
        emitAgentUpdated();
        const agent = await getAgent(created.id);
        if (!agent) {
            throw new Error(`Agent "${created.id}" was not synced after creation.`);
        }
        return toAgentCatalogItem(agent, null);
    } finally {
        client.close();
    }
}

export async function updateAgentName(input: { agentId: string; name: string }) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentName(input.agentId, { name: input.name });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function updateAgentBio(input: { agentId: string; bio: string | null }) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentBio(input.agentId, { bio: input.bio });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function updateAgentModel(input: { agentId: string; modelRef: string }) {
    const model = parseAgentModelRef(input.modelRef);
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentModel(input.agentId, {
            model: {
                model: model.model,
                provider: model.provider,
            },
        });
        await refreshAgentSnapshot({ client, runtimeId });
        emitModelUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function updateAgentThinkingDefault(input: {
    agentId: string;
    thinkingDefault: AgentRuntimeThinkingLevel | null;
}) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentThinkingDefault(input.agentId, {
            thinkingDefault: input.thinkingDefault,
        });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        emitModelUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function updateAgentWebSettings(
    input: AgentRuntimeUpdateAgentWebSettings & { agentId: string }
) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);
    try {
        const agent = await client.updateAgentWebSettings(input.agentId, {
            webAccessEnabled: input.webAccessEnabled,
        });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        return agent;
    } finally {
        client.close();
    }
}

export async function saveDiscordBinding(input: AgentRuntimeSaveDiscordBinding) {
    const { client } = await createClientForAgent(input.agentId);

    try {
        return await client.saveDiscordBinding(input);
    } finally {
        client.close();
    }
}

export async function listDiscordBindings() {
    const client = createConfiguredAgentRuntimeClient();

    if (!client) {
        return [];
    }

    try {
        return (await client.listDiscordBindings()).bindings;
    } catch {
        return [];
    } finally {
        client.close();
    }
}

export async function deleteDiscordBinding(input: { agentId: string; bindingId: string }) {
    const { client } = await createClientForAgent(input.agentId);

    try {
        return await client.deleteDiscordBinding(input.bindingId, {});
    } finally {
        client.close();
    }
}

async function createClientForAgent(agentId: string) {
    const agent = await getAgent(agentId);

    if (!agent) {
        throw new Error(`No agent named "${agentId}" exists.`);
    }

    const client = await createConfiguredAgentRuntimeClientForRuntimeId(agent.runtimeId);

    if (!client) {
        throw new Error(`No enabled Grotto Runtime connection exists for agent "${agentId}".`);
    }

    return {
        client,
        runtimeId: agent.runtimeId,
    };
}

async function refreshAgentSnapshot(input: {
    client: TavernAgentRuntimeClient;
    runtimeId: string;
}) {
    const { agents } = await input.client.listAgents();
    await syncAgentsForRuntime({
        agents,
        runtimeId: input.runtimeId,
    });
    await syncAgentWorkspaceInstructions({
        agents,
        client: input.client,
        runtimeId: input.runtimeId,
    });
}

function createAgentId(name: string) {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32);

    return `agt_${slug || 'agent'}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
}
