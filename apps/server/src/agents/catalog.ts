import type { AgentRuntimeAgent } from '@tavern/api';
import { z } from 'zod';
import {
    deleteAgentRuntimeAgent,
    getAgentRuntimeAgentConfig,
    saveAgentRuntimeAgentConfig,
    toAgentRuntimeCreateAgentConfig,
} from '../agent-runtime/agents.ts';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { skillIdSchema } from '../skills/contracts.ts';
import { findMissingEnabledSkillIds, resolveEnabledSkillIds } from '../skills/enablement.ts';
import { assertSkillsAssignable, listRuntimeSkillSummaries } from '../skills/service.ts';
import * as agentProfileStore from '../storage/agent-profiles.ts';
import {
    getActiveRuntimeId,
    getAgentRuntimeConnection,
} from '../storage/agent-runtime-connections.ts';
import {
    type AgentRecord,
    deleteAgent as deleteAgentRecord,
    getAgent as getAgentRecord,
    listAgents as listAgentRecords,
    parseAgentRawJson,
    syncAgentsForRuntime,
    updateAgentEnabledSkillIds,
} from '../storage/agents.ts';
import { buildAgentPalette, resolveAgentDefaultPrimaryColor, resolveAgentName } from './palette.ts';

export {
    type AgentDiscordBinding,
    buildDiscordBindings,
    buildDiscordUserIdMap,
    querySenderLabelDiscordIds,
} from './discord-bindings.ts';

const hexColorPattern = /^#[0-9a-f]{6}$/i;
const fallbackAgentUpdatedAt = new Date(0).toISOString();

export interface Agent {
    avatarUrl: string | null;
    bio: string | null;
    enabledSkillIds: string[] | null;
    id: string;
    name: string;
    primaryColor: string | null;
    runtimeId: string;
    updatedAt: string;
    userInstructions: string;
    webAccessEnabled: boolean;
}

interface AgentProfileLike {
    primaryColor: string | null;
    updatedAt: string;
    userInstructions: string;
}

interface ActiveRuntimeAgentRead {
    agent: AgentRuntimeAgent;
    client: TavernAgentRuntimeClient;
    runtimeId: string;
}

export const agentDisplayNameSchema = z
    .string()
    .trim()
    .max(80)
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

export const agentPrimaryColorSchema = z
    .string()
    .trim()
    .regex(hexColorPattern, 'Use a 6-digit hex color.')
    .nullable()
    .transform((value) => (value && value.length > 0 ? value.toLowerCase() : null));

export const agentEnabledSkillIdsSchema = z.array(skillIdSchema).nullable();
export const agentUserInstructionsSchema = z.string().max(20_000).nullable();

export interface AgentCatalogItem {
    avatarUrl: string | null;
    bio: string | null;
    defaultPrimaryColor: string;
    effectivePrimaryColor: string;
    enabledSkillIds: string[];
    id: string;
    name: string;
    primaryColor: string | null;
    runtimeId: string;
    title: string;
    updatedAt: string;
    userInstructions: string;
    usesAllSkills: boolean;
    webAccessEnabled: boolean;
}

function parseEnabledSkillIds(agent: AgentRecord) {
    const raw = JSON.parse(agent.enabledSkillIdsJson) as unknown;
    const parsed = z.array(skillIdSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
}

function toAgent(agent: AgentRecord, profile: AgentProfileLike | null): Agent {
    const runtimeAgent = parseAgentRawJson(agent);
    return {
        webAccessEnabled: runtimeAgent.webAccessEnabled === true,
        avatarUrl: runtimeAgent.avatarUrl ?? null,
        bio: runtimeAgent.bio ?? null,
        enabledSkillIds: parseEnabledSkillIds(agent),
        id: agent.id,
        name: agent.name,
        primaryColor: profile?.primaryColor ?? agent.primaryColor ?? null,
        runtimeId: agent.runtimeId,
        updatedAt: profile?.updatedAt ?? fallbackAgentUpdatedAt,
        userInstructions: profile?.userInstructions ?? '',
    };
}

export async function listAgents() {
    const profiles = await agentProfileStore.listAgentProfiles();
    const activeRuntimeAgents = await listActiveRuntimeAgents();

    const profilesByAgentKey = new Map(
        profiles.map((profile) => [`${profile.runtimeId}:${profile.agentId}`, profile] as const)
    );

    if (activeRuntimeAgents) {
        return activeRuntimeAgents.agents.map((agent) =>
            toAgentFromAgentRuntimeAgent({
                agent,
                id: agent.id,
                profile:
                    profilesByAgentKey.get(`${activeRuntimeAgents.runtimeId}:${agent.id}`) ?? null,
                runtimeId: activeRuntimeAgents.runtimeId,
            })
        );
    }

    const agents = await listAgentRecords();

    return agents.map((agent) =>
        toAgent(agent, profilesByAgentKey.get(`${agent.runtimeId}:${agent.id}`) ?? null)
    );
}

export async function getAgent(agentId: string): Promise<null | Agent> {
    return (await listAgents()).find((agent) => agent.id === agentId) ?? null;
}

export function toAgentCatalogItem(
    agent: Agent,
    availableSkillIds: null | string[] = []
): AgentCatalogItem {
    const enabledSkillIds =
        availableSkillIds === null
            ? [...new Set(agent.enabledSkillIds ?? [])]
            : resolveEnabledSkillIds(agent.enabledSkillIds, availableSkillIds);

    return {
        webAccessEnabled: agent.webAccessEnabled,
        avatarUrl: agent.avatarUrl,
        bio: agent.bio,
        defaultPrimaryColor: resolveAgentDefaultPrimaryColor(agent.id),
        effectivePrimaryColor: buildAgentPalette(agent).accentFrom,
        enabledSkillIds,
        id: agent.id,
        name: resolveAgentName(agent),
        primaryColor: agent.primaryColor,
        runtimeId: agent.runtimeId,
        title: agent.name,
        updatedAt: agent.updatedAt,
        userInstructions: agent.userInstructions,
        usesAllSkills:
            availableSkillIds !== null &&
            availableSkillIds.length > 0 &&
            enabledSkillIds.length === availableSkillIds.length,
    };
}

export async function listAgentCatalog() {
    const agents = await listAgents();

    return agents
        .map((agent) => toAgentCatalogItem(agent, null))
        .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getPrimaryAgent() {
    const runtimeId = await getActiveRuntimeId();
    const agents = await listAgents();
    const scopedAgents = runtimeId
        ? agents.filter((agent) => agent.runtimeId === runtimeId)
        : agents;

    return (
        scopedAgents
            .map((agent) => toAgentCatalogItem(agent, null))
            .sort((left, right) => left.name.localeCompare(right.name))[0] ?? null
    );
}

export async function requirePrimaryAgent() {
    const agent = await getPrimaryAgent();

    if (!agent) {
        throw new Error('No agent exists. Start Grotto Runtime first.');
    }

    return agent;
}

export async function saveCatalogAgentSettings(
    input: {
        agentId: string;
        displayName?: string | null;
        enabledSkillIds?: string[] | null;
    },
    client?: TavernAgentRuntimeClient | null
) {
    const agentRecord = await getAgentRecord(input.agentId);
    const runtimeAgentRead =
        agentRecord === null ? await getActiveRuntimeAgent(input.agentId, client) : null;

    if (!(agentRecord || runtimeAgentRead)) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    const runtimeId = agentRecord?.runtimeId ?? runtimeAgentRead?.runtimeId ?? '';
    const runtimeClient =
        client ??
        (agentRecord ? await createClientForAgentRecord(agentRecord) : runtimeAgentRead?.client);

    if (!runtimeClient) {
        throw new Error(
            `No enabled Grotto Runtime connection exists for agent "${input.agentId}".`
        );
    }

    let availableSkillIdsForResponse: null | string[] = null;
    let nextEnabledSkillIds: string[] | undefined;

    if (input.enabledSkillIds !== undefined) {
        // Read the library view, not the agent view: agent-scoped reads mark
        // unassigned skills as ineligible, which would reject every new assignment.
        const runtimeSkills = await listRuntimeSkillSummaries({
            client: runtimeClient,
            runtimeId,
        });
        const availableSkillIds = runtimeSkills.map((skill) => skill.id);
        availableSkillIdsForResponse = availableSkillIds;
        const missingSkillIds = findMissingEnabledSkillIds(
            input.enabledSkillIds,
            availableSkillIds
        );

        if (missingSkillIds.length > 0) {
            throw new Error(`Unknown skills: ${missingSkillIds.join(', ')}.`);
        }

        const currentEnabledSkillIds = new Set(
            agentRecord
                ? parseEnabledSkillIds(agentRecord)
                : (runtimeAgentRead?.agent.enabledSkillIds ?? [])
        );
        assertSkillsAssignable(
            (input.enabledSkillIds ?? []).filter((skillId) => !currentEnabledSkillIds.has(skillId)),
            runtimeSkills
        );

        nextEnabledSkillIds = resolveEnabledSkillIds(input.enabledSkillIds, availableSkillIds);
    }

    let savedAgentRuntimeAgent: AgentRuntimeAgent | null = null;
    if (input.displayName !== undefined || input.enabledSkillIds !== undefined) {
        const agentRuntimeAgent = await getAgentRuntimeAgentConfig(input.agentId, runtimeClient);

        if (!agentRuntimeAgent) {
            throw new Error(`No runtime agent named "${input.agentId}" exists.`);
        }

        const { enabledSkillIds: _currentEnabledSkillIds, ...agentRuntimeConfigWithoutSkills } =
            toAgentRuntimeCreateAgentConfig(agentRuntimeAgent);
        savedAgentRuntimeAgent = await saveAgentRuntimeAgentConfig(
            {
                ...agentRuntimeConfigWithoutSkills,
                ...(nextEnabledSkillIds === undefined
                    ? {}
                    : { enabledSkillIds: nextEnabledSkillIds }),
                name: input.displayName ?? agentRuntimeAgent.name,
            },
            runtimeClient
        );
    }

    const profile = await agentProfileStore.getAgentProfile({
        agentId: input.agentId,
        runtimeId,
    });

    if (agentRecord && savedAgentRuntimeAgent) {
        await syncAgentsForRuntime({
            agents: (await runtimeClient.listAgents()).agents,
            runtimeId: agentRecord.runtimeId,
        });
    }

    if (agentRecord && input.enabledSkillIds !== undefined) {
        await updateAgentEnabledSkillIds({
            agentId: input.agentId,
            enabledSkillIds: nextEnabledSkillIds ?? [],
        });
    }

    const latestAgentRecord = agentRecord ? await getAgentRecord(input.agentId) : null;
    const storedAgent = latestAgentRecord ?? agentRecord;
    const runtimeAgent = savedAgentRuntimeAgent ?? runtimeAgentRead?.agent ?? null;
    const agent = storedAgent
        ? toAgent(
              latestAgentRecord ?? {
                  ...storedAgent,
                  enabledSkillIdsJson: JSON.stringify(
                      nextEnabledSkillIds ?? parseEnabledSkillIds(storedAgent)
                  ),
              },
              profile
          )
        : runtimeAgent
          ? toAgentFromAgentRuntimeAgent({
                agent: runtimeAgent,
                id: input.agentId,
                profile,
                runtimeId,
            })
          : null;

    if (!agent) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    return toAgentCatalogItem(agent, availableSkillIdsForResponse);
}

export async function saveCatalogAgentProfile(input: {
    agentId: string;
    primaryColor?: string | null;
    userInstructions?: string | null;
}) {
    const agentRecord = await getAgentRecord(input.agentId);
    const runtimeAgentRead =
        agentRecord === null ? await getActiveRuntimeAgent(input.agentId) : null;

    if (!(agentRecord || runtimeAgentRead)) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    const runtimeId = agentRecord?.runtimeId ?? runtimeAgentRead?.runtimeId ?? '';
    const profileInput = {
        agentId: input.agentId,
        runtimeId,
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
        ...(input.userInstructions !== undefined
            ? { userInstructions: input.userInstructions }
            : {}),
    };
    const profile = await agentProfileStore.saveAgentProfile(profileInput);

    if (!profile) {
        throw new Error(`Failed to save profile for agent "${input.agentId}".`);
    }

    const agent = agentRecord
        ? toAgent(agentRecord, profile)
        : runtimeAgentRead
          ? toAgentFromAgentRuntimeAgent({
                agent: runtimeAgentRead.agent,
                id: input.agentId,
                profile,
                runtimeId,
            })
          : null;

    if (!agent) {
        throw new Error(`No agent named "${input.agentId}" exists.`);
    }

    return toAgentCatalogItem(agent, null);
}

export async function getCatalogAgentInstructions(agentId: string) {
    const agentRecord = await getAgentRecord(agentId);
    const runtimeAgentRead = agentRecord === null ? await getActiveRuntimeAgent(agentId) : null;

    if (!(agentRecord || runtimeAgentRead)) {
        throw new Error(`No agent named "${agentId}" exists.`);
    }

    const runtimeClient = agentRecord
        ? await createClientForAgentRecord(agentRecord)
        : runtimeAgentRead?.client;

    if (!runtimeClient) {
        throw new Error(`No enabled Grotto Runtime connection exists for agent "${agentId}".`);
    }

    return runtimeClient.getWorkspaceInstructions(agentId);
}

export async function deleteCatalogAgent(
    agentId: string,
    client?: TavernAgentRuntimeClient | null
) {
    const agentRecord = await getAgentRecord(agentId);
    const runtimeAgentRead = agentRecord === null ? await getActiveRuntimeAgent(agentId) : null;

    if (!(agentRecord || runtimeAgentRead)) {
        return;
    }

    await deleteAgentRuntimeAgent(
        agentId,
        client ??
            (agentRecord ? await createClientForAgentRecord(agentRecord) : runtimeAgentRead?.client)
    );
    await agentProfileStore.deleteAgentProfile({
        agentId,
        runtimeId: agentRecord?.runtimeId ?? runtimeAgentRead?.runtimeId ?? '',
    });
    if (agentRecord) {
        await deleteAgentRecord(agentId);
    }
}

async function createClientForAgentRecord(agent: AgentRecord) {
    return await createClientForRuntimeId(agent.runtimeId);
}

async function createClientForRuntimeId(runtimeId: string) {
    const connection = await getAgentRuntimeConnection(runtimeId);

    if (!connection?.enabled) {
        throw new Error(`No enabled Grotto Runtime connection named "${runtimeId}" exists.`);
    }

    return createAgentRuntimeClientForConnection(connection);
}

async function listActiveRuntimeAgents() {
    const runtimeId = await getActiveRuntimeId();

    if (!runtimeId) {
        return null;
    }

    const connection = await getAgentRuntimeConnection(runtimeId);

    if (!connection?.enabled) {
        return null;
    }

    const client = createAgentRuntimeClientForConnection(connection);

    try {
        return {
            agents: (await client.listAgents()).agents,
            runtimeId,
        };
    } finally {
        client.close();
    }
}

async function getActiveRuntimeAgent(
    agentId: string,
    client?: TavernAgentRuntimeClient | null
): Promise<ActiveRuntimeAgentRead | null> {
    const runtimeId = await getActiveRuntimeId();

    if (!runtimeId) {
        return null;
    }

    const runtimeClient = client ?? (await createClientForRuntimeId(runtimeId));
    const agent = (await runtimeClient.listAgents()).agents.find(
        (candidate) => candidate.id === agentId
    );

    return agent ? { agent, client: runtimeClient, runtimeId } : null;
}

function toAgentFromAgentRuntimeAgent(input: {
    agent: AgentRuntimeAgent;
    id: string;
    profile: AgentProfileLike | null;
    runtimeId: string;
}): Agent {
    return {
        webAccessEnabled: input.agent.webAccessEnabled === true,
        avatarUrl: input.agent.avatarUrl ?? null,
        bio: input.agent.bio ?? null,
        enabledSkillIds: input.agent.enabledSkillIds,
        id: input.id,
        name: input.agent.name,
        primaryColor: input.profile?.primaryColor ?? input.agent.primaryColor ?? null,
        runtimeId: input.runtimeId,
        updatedAt: input.profile?.updatedAt ?? fallbackAgentUpdatedAt,
        userInstructions: input.profile?.userInstructions ?? '',
    };
}
