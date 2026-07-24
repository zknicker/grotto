import type { AgentRuntimeSkillSummary } from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import {
    getAgentRuntimeSkill,
    listAgentRuntimeSkills,
    resetAgentRuntimeSkill,
    setAgentRuntimeSkillEnabled,
} from '../agent-runtime/skills.ts';
import { listAgentRuntimeTools, setAgentRuntimeToolEnabled } from '../agent-runtime/tools.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import {
    type SkillList,
    type SkillSummary,
    setSkillEnabledInputSchema,
    setToolEnabledInputSchema,
    skillIdSchema,
    skillListSchema,
    skillResetInputSchema,
    skillSummarySchema,
    type ToolSummary,
} from './contracts.ts';
import {
    enqueueRuntimeSkillInventoryRefresh,
    enqueueRuntimeSkillInventoryRefreshIfStale,
} from './inventory-job.ts';
import { getCachedRuntimeSkillInventory, refreshRuntimeSkillInventory } from './inventory-sync.ts';
export async function listSkills(): Promise<SkillList> {
    const [runtime, tools] = await Promise.all([
        getActiveAgentRuntimeConnection(),
        listAgentRuntimeTools().catch(() => []),
    ]);
    const skillRuntimeId = getSkillInventoryRuntimeId(runtime);
    const runtimeTools = tools ?? [];
    const cachedInventory = skillRuntimeId
        ? await getCachedRuntimeSkillInventory(skillRuntimeId).catch(() => null)
        : null;

    void enqueueRuntimeSkillInventoryRefreshIfStale(skillRuntimeId).catch(() => undefined);

    return skillListSchema.parse({
        skills: filterRuntimeVisibleSkills(cachedInventory?.skills ?? []).map((skill) =>
            buildSkillSummary(skill)
        ),
        tools: runtimeTools.map((tool) => buildToolSummary(tool)),
    });
}

export async function getSkill(input: unknown) {
    const parsed = skillIdSchema.parse(input);
    const skill = await getAgentRuntimeSkill(parsed);
    if (!skill) {
        throw new Error('Runtime skill details are unavailable.');
    }
    return skill;
}

export async function setSkillEnabled(input: unknown): Promise<SkillList> {
    const parsed = setSkillEnabledInputSchema.parse(input);
    const runtime = await getActiveAgentRuntimeConnection();
    const skillRuntimeId = getSkillInventoryRuntimeId(runtime);
    const cachedInventory = skillRuntimeId
        ? await getCachedRuntimeSkillInventory(skillRuntimeId).catch(() => null)
        : null;
    const _skill = cachedInventory?.skills.find((candidate) => candidate.id === parsed.skillId);
    const updated = await setAgentRuntimeSkillEnabled(parsed.skillId, { enabled: parsed.enabled });
    if (!updated) {
        throw new Error('Runtime skill enablement is unavailable.');
    }

    await refreshRuntimeSkillInventory().catch(async () => {
        await enqueueRuntimeSkillInventoryRefresh().catch(() => undefined);
    });
    emitSkillInvalidationCascade();

    return await listSkills();
}

export async function resetSkill(input: unknown) {
    const parsed = skillResetInputSchema.parse(input);
    const result = await resetAgentRuntimeSkill(parsed.skillId);
    if (!result) {
        throw new Error('Runtime skill reset is unavailable.');
    }

    await refreshRuntimeSkillInventory().catch(async () => {
        await enqueueRuntimeSkillInventoryRefresh().catch(() => undefined);
    });
    emitSkillInvalidationCascade();

    return result;
}

export async function setToolEnabled(input: unknown): Promise<SkillList> {
    const parsed = setToolEnabledInputSchema.parse(input);
    const updated = await setAgentRuntimeToolEnabled(parsed.toolId, {
        enabled: parsed.enabled,
    });
    if (!updated) {
        throw new Error('Runtime tool enablement is unavailable.');
    }

    emitSkillInvalidationCascade();

    return await listSkills();
}

export async function listRuntimeSkillSummaries(input?: {
    agentId?: string;
    client?: TavernAgentRuntimeClient | null;
    runtimeId?: string | null;
}) {
    return (
        (await listAgentRuntimeSkills(input?.client, input?.runtimeId, {
            agentId: input?.agentId,
        })) ?? []
    );
}

export function assertSkillsAssignable(
    addedSkillIds: string[],
    skills: AgentRuntimeSkillSummary[]
) {
    for (const skillId of addedSkillIds) {
        const skill = skills.find((candidate) => candidate.id === skillId);
        if (!skill) {
            continue;
        }
        if (!isSkillEnabled(skill)) {
            throw new Error(
                `Enable ${skill.name} in Settings -> Skills before assigning it to an agent.`
            );
        }
        if (resolveDependencyState(skill) === 'missing') {
            const missing = formatMissingRequirements(skill.missing);
            throw new Error(
                `${skill.name} needs setup before it can be assigned to an agent${missing ? `: ${missing}` : ''}.`
            );
        }
    }
}

function getSkillInventoryRuntimeId(
    runtime: Awaited<ReturnType<typeof getActiveAgentRuntimeConnection>>
) {
    if (!(runtime?.enabled && runtime.lastCheckedAt)) {
        return null;
    }

    return runtime.id;
}

export function filterRuntimeVisibleSkills(skills: AgentRuntimeSkillSummary[]) {
    return skills.filter((skill) => isRuntimeVisibleSkill(skill));
}

function isRuntimeVisibleSkill(skill: AgentRuntimeSkillSummary) {
    return skill.blockedByAllowlist !== true;
}

function buildSkillSummary(skill: AgentRuntimeSkillSummary) {
    const dependencyState = resolveDependencyState(skill);
    const enabled = isSkillEnabled(skill);
    const usability = resolveSkillUsability({ dependencyState, enabled });

    return skillSummarySchema.parse({
        allowedTools: skill.allowedTools,
        diagnostic: buildSkillDiagnostic(skill, dependencyState),
        dependencyState,
        description: skill.description,
        enabled,
        id: skill.id,
        missing: skill.missing,
        name: skill.name,
        readOnly: false,
        surface: resolveSkillSurface(),
        updatedAt: skill.updatedAt,
        usability,
        version: null,
    });
}

function resolveSkillSurface(): SkillSummary['surface'] {
    return 'agent';
}

function buildToolSummary(tool: {
    configured: boolean;
    description: null | string;
    enabled: boolean;
    id: string;
    label: string;
    placeholder?: boolean;
    readOnly?: boolean;
    tools: string[];
}): ToolSummary {
    const enabled = tool.enabled;
    const diagnostic = resolveToolDiagnostic({ enabled, tool });
    return {
        configured: tool.configured,
        description: tool.description,
        diagnostic,
        enabled,
        id: tool.id,
        name: tool.label,
        readOnly: tool.readOnly ?? false,
        tools: tool.tools,
        usability: diagnostic ? 'not_usable' : enabled ? 'enabled' : 'disabled',
    };
}

function resolveToolDiagnostic(input: {
    enabled: boolean;
    tool: { configured: boolean; placeholder?: boolean };
}) {
    if (input.enabled && !input.tool.configured) {
        return 'Required provider keys are missing.';
    }
    return null;
}

function resolveSkillUsability(input: {
    dependencyState: SkillSummary['dependencyState'];
    enabled: boolean;
}): SkillSummary['usability'] {
    if (!input.enabled) {
        return 'disabled';
    }
    if (input.dependencyState === 'missing') {
        return 'not_usable';
    }
    return 'enabled';
}

function isSkillEnabled(skill: AgentRuntimeSkillSummary) {
    return skill.disabled !== true && skill.userInvocable !== false;
}

function buildSkillDiagnostic(
    skill: AgentRuntimeSkillSummary,
    dependencyState: SkillSummary['dependencyState']
) {
    if (dependencyState !== 'missing') {
        return null;
    }
    return formatMissingRequirements(skill.missing) ?? 'Required runtime setup is missing.';
}

function resolveDependencyState(skill: AgentRuntimeSkillSummary): SkillSummary['dependencyState'] {
    if (skill.eligible === false || hasRequirements(skill.missing)) {
        return 'missing';
    }

    return 'ready';
}

function hasRequirements(requirements: SkillSummary['missing']) {
    return (
        requirements.anyBins.length > 0 ||
        requirements.bins.length > 0 ||
        requirements.config.length > 0 ||
        requirements.env.length > 0 ||
        requirements.os.length > 0
    );
}

function formatMissingRequirements(requirements: SkillSummary['missing']) {
    const missing = [
        ...requirements.bins.map((value) => `bin ${value}`),
        ...requirements.anyBins.map((value) => `any bin ${value}`),
        ...requirements.env.map((value) => `env ${value}`),
        ...requirements.config.map((value) => `config ${value}`),
        ...requirements.os.map((value) => `os ${value}`),
    ];

    return missing.length > 0 ? `Missing ${missing.join(', ')}` : null;
}
