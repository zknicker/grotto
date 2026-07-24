import * as z from 'zod';
import {
    agentEngineSkillsDir,
    getRuntimeSkill,
    listRuntimeSkills,
} from '../agent-engine/skill-library.ts';
import {
    assertCanonicalSkillId,
    createAgentSkill,
    listSkillSupportFileSnapshots,
    patchSkillMarkdown,
    readSkillMarkdownSnapshot,
    readSkillSource,
    sha256,
    skillIdFromName,
    skillPackageIsContained,
    writeSkillSupportFile,
} from '../skills/store.ts';
import { recordSkillUsage } from '../skills/telemetry.ts';
import { AgentApiError } from './agent-api-errors.ts';
import { getStoredAgent } from './agents-store.ts';

export const agentSkillCreateRequestSchema = z
    .object({
        content: z.string().min(1),
        description: z.string().trim().min(1),
        name: z.string().trim().min(1),
    })
    .strict();

export const agentSkillPatchRequestSchema = z
    .object({
        content: z.string().min(1),
        expectedHash: z.string().trim().min(1),
        skillId: z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u),
    })
    .strict();

export const agentSkillWriteFileRequestSchema = z
    .object({
        content: z.string(),
        expectedHash: z.string().trim().min(1).nullable(),
        filePath: z.string().trim().min(1),
        skillId: z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u),
    })
    .strict();

export async function listAgentSkills(agentId: string, skillsDir = agentEngineSkillsDir) {
    const skills = await listRuntimeSkills({ skillsDir });
    return { skills: skills.map((skill) => skillSummary(agentId, skill)) };
}

export async function viewAgentSkill(
    agentId: string,
    skillId: string,
    skillsDir = agentEngineSkillsDir
) {
    try {
        assertCanonicalSkillId(skillId);
    } catch (error) {
        throw new AgentApiError(
            'INVALID_ARG',
            error instanceof Error ? error.message : 'Skill id is invalid.',
            400
        );
    }
    const contained = await skillPackageIsContained({ skillId, skillsDir }).catch(() => false);
    if (!contained) {
        throw new AgentApiError('SKILL_NOT_FOUND', `Skill not found: ${skillId}`, 404);
    }
    const skill = await getRuntimeSkill(skillId, { skillsDir });
    if (!skill) {
        throw new AgentApiError('SKILL_NOT_FOUND', `Skill not found: ${skillId}`, 404);
    }
    const snapshot = await readSkillMarkdownSnapshot({ skillId: skill.id, skillsDir });
    const content = snapshot?.content ?? skill.contentMarkdown;
    const supportFiles = await listSkillSupportFileSnapshots({ skillId: skill.id, skillsDir });
    recordSkillUsage({ agentId, kind: 'viewed', skillId: skill.id });
    return {
        ...skillSummary(agentId, skill),
        content,
        hash: snapshot?.hash ?? sha256(content),
        supportFiles,
    };
}

export async function createAgentAuthoredSkill(
    agentId: string,
    input: z.infer<typeof agentSkillCreateRequestSchema>,
    skillsDir = agentEngineSkillsDir
) {
    let skillId: string;
    try {
        skillId = skillIdFromName(input.name);
    } catch (error) {
        throw new AgentApiError(
            'INVALID_ARG',
            error instanceof Error ? error.message : 'Skill name is invalid.',
            400
        );
    }
    const existing = await listRuntimeSkills({ skillsDir });
    if (existing.some((skill) => skill.id === skillId)) {
        throw new AgentApiError('SKILL_EXISTS', `Skill already exists: ${skillId}`, 409);
    }
    let created: Awaited<ReturnType<typeof createAgentSkill>>;
    try {
        created = await createAgentSkill({ agentId, ...input, skillsDir });
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Skill already exists:')) {
            throw new AgentApiError('SKILL_EXISTS', error.message, 409);
        }
        throw error;
    }
    return {
        skill: {
            description: created.description,
            editable: created.writable,
            enabledForYou: true,
            id: created.id,
            name: created.name,
        },
    };
}

export async function patchAgentSkill(
    agentId: string,
    input: z.infer<typeof agentSkillPatchRequestSchema>,
    skillsDir = agentEngineSkillsDir
) {
    assertAgentOwnsSkill(agentId, input.skillId);
    try {
        return { change: await patchSkillMarkdown({ ...input, skillsDir }) };
    } catch (error) {
        throw skillWriteError('SKILL_PATCH_FAILED', error);
    }
}

export async function writeAgentSkillFile(
    agentId: string,
    input: z.infer<typeof agentSkillWriteFileRequestSchema>,
    skillsDir = agentEngineSkillsDir
) {
    assertAgentOwnsSkill(agentId, input.skillId);
    try {
        return { change: await writeSkillSupportFile({ ...input, skillsDir }) };
    } catch (error) {
        throw skillWriteError('SKILL_WRITE_FAILED', error);
    }
}

function skillSummary(
    agentId: string,
    skill: { description?: string | null; id: string; name: string }
) {
    return {
        description: skill.description ?? skill.name,
        editable: isAgentSkillEditable(agentId, skill.id),
        enabledForYou: getStoredAgent(agentId)?.enabledSkillIds.includes(skill.id) ?? false,
        id: skill.id,
        name: skill.name,
    };
}

function assertAgentOwnsSkill(agentId: string, skillId: string) {
    if (!isAgentSkillEditable(agentId, skillId)) {
        throw new AgentApiError(
            'SKILL_NOT_EDITABLE',
            'Agents may edit only skills they created.',
            403
        );
    }
}

function isAgentSkillEditable(agentId: string, skillId: string) {
    const source = readSkillSource(skillId);
    return source?.source === 'agent' && source.createdByAgentId === agentId;
}

function skillWriteError(code: string, error: unknown) {
    return new AgentApiError(
        code,
        error instanceof Error ? error.message : 'Skill write failed.',
        409
    );
}
