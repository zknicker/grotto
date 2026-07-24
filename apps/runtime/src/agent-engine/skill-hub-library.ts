import fs from 'node:fs/promises';
import path from 'node:path';
import {
    type AgentRuntimeSkillHubActionResult,
    type AgentRuntimeSkillHubAvailable,
    type AgentRuntimeSkillHubPreview,
    type AgentRuntimeSkillHubScan,
    agentRuntimeSkillHubActionResultSchema,
    agentRuntimeSkillHubAvailableSchema,
    agentRuntimeSkillHubPreviewSchema,
    agentRuntimeSkillHubScanSchema,
} from '@tavern/api';
import {
    deleteSkillSource,
    readSkillSource,
    sha256,
    tryRecordSkillSource,
} from '../skills/store.ts';
import { builtInHubSkills, bundledHubSkillContent } from './bundled-hub-skills.ts';
import {
    agentEngineSkillsDir,
    isSeededSkillId,
    listRuntimeSkills,
    normalizeRuntimeSkillId,
} from './skill-library.ts';

export async function getSkillHubAvailable(
    options: { skillsDir?: string } = {}
): Promise<AgentRuntimeSkillHubAvailable> {
    const installedSkills = await listRuntimeSkills(options);
    const installedByName = new Map(installedSkills.map((skill) => [skill.name, skill]));

    return agentRuntimeSkillHubAvailableSchema.parse({
        builtin: builtInHubSkills.map(({ skillMd: _skillMd, ...skill }) => skill),
        installed: Object.fromEntries(
            await Promise.all(
                builtInHubSkills
                    .filter((skill) => installedByName.has(skill.name))
                    .map(async (skill) => {
                        const installed = installedByName.get(skill.name);
                        const source = tryReadSkillSource(skill.name);
                        const installedHash = source?.installedHash ?? null;
                        const currentHash =
                            installed?.filePath && installedHash
                                ? await hashFileOrNull(installed.filePath)
                                : null;
                        const bundledContent = bundledHubSkillContent(skill.name);
                        return [
                            skill.identifier,
                            {
                                edited:
                                    installedHash !== null &&
                                    currentHash !== null &&
                                    currentHash !== installedHash,
                                name: skill.name,
                                scanVerdict: 'allow',
                                trustLevel: skill.trustLevel,
                                updateAvailable:
                                    installedHash !== null &&
                                    bundledContent !== null &&
                                    sha256(bundledContent) !== installedHash,
                            },
                        ];
                    })
            )
        ),
        taps: [],
    });
}

export function previewSkillHubSkill(identifier: string): AgentRuntimeSkillHubPreview | null {
    const skill = builtInHubSkills.find((candidate) => candidate.identifier === identifier);
    if (!skill) {
        return null;
    }

    const { skillMd, ...item } = skill;
    return agentRuntimeSkillHubPreviewSchema.parse({
        ...item,
        files: ['SKILL.md'],
        skillMd,
    });
}

export function scanSkillHubSkill(identifier: string): AgentRuntimeSkillHubScan | null {
    const skill = builtInHubSkills.find((candidate) => candidate.identifier === identifier);
    if (!skill) {
        return null;
    }

    return agentRuntimeSkillHubScanSchema.parse({
        findings: [],
        identifier: skill.identifier,
        name: skill.name,
        policy: 'allow',
        policyReason: 'Built-in Grotto skill.',
        severityCounts: {},
        source: skill.source,
        summary: 'No findings.',
        trustLevel: skill.trustLevel,
        verdict: 'allow',
    });
}

export async function installSkillHubSkill(
    identifier: string,
    options: { force?: boolean; skillsDir?: string } = {}
): Promise<AgentRuntimeSkillHubActionResult> {
    const skill = builtInHubSkills.find((candidate) => candidate.identifier === identifier);
    if (!skill) {
        return actionResult(false, [`Unknown skill: ${identifier}`], null);
    }

    const skillPath = path.join(options.skillsDir ?? agentEngineSkillsDir, skill.name, 'SKILL.md');
    const previous = await fs.readFile(skillPath, 'utf8').catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    const installedHash = tryReadSkillSource(skill.name)?.installedHash ?? null;
    if (
        previous !== null &&
        installedHash &&
        sha256(previous) !== installedHash &&
        !options.force
    ) {
        return actionResult(
            false,
            [`${skill.name} was edited since install. Reinstall with force to replace it.`],
            null,
            true
        );
    }

    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, skill.skillMd, { mode: 0o600 });
    tryRecordSkillSource({
        installedHash: sha256(skill.skillMd),
        skillId: skill.name,
        source: 'hub',
    });

    return actionResult(true, [`Installed ${skill.name}.`], 0);
}

export async function uninstallSkillHubSkill(
    name: string,
    options: { skillsDir?: string } = {}
): Promise<AgentRuntimeSkillHubActionResult> {
    const normalized = normalizeRuntimeSkillId(name);
    if (!normalized) {
        return actionResult(false, [`Invalid skill name: ${name}`], null);
    }
    if (isSeededSkillId(normalized)) {
        return actionResult(false, [`${normalized} is a bundled Runtime skill.`], null);
    }

    const skillDir = path.join(options.skillsDir ?? agentEngineSkillsDir, normalized);
    const exists = await fs.stat(path.join(skillDir, 'SKILL.md')).catch(() => null);
    if (!exists) {
        return actionResult(false, [`Skill is not installed: ${normalized}`], null);
    }

    await fs.rm(skillDir, { force: true, recursive: true });
    tryDeleteSkillSource(normalized);
    return actionResult(true, [`Uninstalled ${normalized}.`], 0);
}

function actionResult(
    ok: boolean,
    log: string[],
    exitCode: number | null,
    conflict?: boolean
): AgentRuntimeSkillHubActionResult {
    return agentRuntimeSkillHubActionResultSchema.parse({ conflict, exitCode, log, ok });
}

function tryDeleteSkillSource(skillId: string) {
    try {
        deleteSkillSource(skillId);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Database not initialized')) {
            return;
        }
        throw error;
    }
}

function hashFileOrNull(filePath: string) {
    return fs
        .readFile(filePath, 'utf8')
        .then((content) => sha256(content))
        .catch((error) => {
            if (isNotFoundError(error)) {
                return null;
            }
            throw error;
        });
}

function tryReadSkillSource(skillId: string) {
    try {
        return readSkillSource(skillId);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Database not initialized')) {
            return null;
        }
        throw error;
    }
}

function isNotFoundError(error: unknown) {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
