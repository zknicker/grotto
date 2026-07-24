import fs from 'node:fs/promises';
import path from 'node:path';
import {
    type AgentRuntimeAgent,
    type AgentRuntimeSkill,
    type AgentRuntimeSkillFile,
    type AgentRuntimeSkillSummary,
    agentRuntimeSkillListSchema,
    agentRuntimeSkillSchema,
    agentRuntimeSkillSummarySchema,
    isReservedAgentRuntimeSkillFilePath,
    normalizeAgentRuntimeSkillFiles,
} from '@tavern/api';
import { browserSkillContent } from '../browser/browser-skill.generated.ts';
import { AGENT_HOME } from '../config.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { publishSkillUpdated } from '../skills/events.ts';
import { sha256, tryRecordSkillSource } from '../skills/store.ts';
import { hasAgentHostToolGrant } from './host-tools.ts';
import {
    managedSkillSummaryState,
    type SkillSummarySource,
    tryReadSkillSummarySource,
} from './managed-skill-summary.ts';
import { defaultVisualsSkill, visualsSkillFiles, visualsSkillId } from './visuals-skill.ts';

export { visualsSkillId };

export const agentEngineSkillsDir = path.join(AGENT_HOME, 'skills');
export const tavernAgentSkillId = 'tavern-agent';

export const defaultTavernSkill = `# Grotto Agent

Use Grotto chat context, memory, files, and local tools. Keep replies direct and action-oriented.
`;

const seededSkillDefaults: Record<string, string> = {
    [tavernAgentSkillId]: defaultTavernSkill,
    [visualsSkillId]: defaultVisualsSkill,
};

/** Reference/asset files seeded beside SKILL.md, keyed by relative path. */
const seededSkillExtraFiles: Record<string, Record<string, string>> = {
    [visualsSkillId]: visualsSkillFiles,
};

export function isSeededSkillId(skillId: string): boolean {
    return skillId in seededSkillDefaults;
}

export function seededSkillDefaultEntries(): [skillId: string, content: string][] {
    return Object.entries(seededSkillDefaults);
}

const emptyRequirements = {
    anyBins: [],
    bins: [],
    config: [],
    env: [],
    os: [],
};

export interface AssignedSkillBundle {
    content: string;
    description: string;
    files: AssignedSkillFile[];
    id: string;
    name: string;
    path: string | null;
}

export interface AssignedSkillFile {
    content: string;
    path: string;
}

interface RuntimeSkillOptions {
    agent?: AgentRuntimeAgent | null;
    skillsDir?: string;
}

export async function seedManagedSkills(options: { skillsDir?: string } = {}) {
    for (const skillId of Object.keys(seededSkillDefaults)) {
        await seedSeededSkill(skillId, options);
    }
}

async function seedSeededSkill(skillId: string, options: { skillsDir?: string } = {}) {
    const defaultContent = seededSkillDefaults[skillId];
    if (defaultContent === undefined) {
        throw new Error(`Skill ${skillId} is not a seeded Grotto skill.`);
    }

    let replacedExisting = false;
    let changed = false;
    for (const [relativePath, content] of seededSkillEntries(skillId, defaultContent)) {
        const filePath = seededSkillFilePath({ options, relativePath, skillId });
        const existing = await fs.readFile(filePath, 'utf8').catch(() => null);
        if (existing === content) {
            continue;
        }
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, { mode: 0o600 });
        changed = true;
        replacedExisting ||= existing !== null;
    }

    recordSeededSkillSource(skillId);
    if (changed && replacedExisting) {
        publishSkillUpdated(skillId);
    }
}

export async function resetSeededSkill(skillId: string, options: { skillsDir?: string } = {}) {
    const defaultContent = seededSkillDefaults[skillId];
    if (defaultContent === undefined) {
        throw new Error(`Skill ${skillId} is not a seeded Grotto skill.`);
    }
    for (const [relativePath, content] of seededSkillEntries(skillId, defaultContent)) {
        const filePath = seededSkillFilePath({ options, relativePath, skillId });
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, { mode: 0o600 });
    }
    recordSeededSkillSource(skillId);
    publishSkillUpdated(skillId);
    return {
        hash: sha256(defaultContent),
        skillId,
    };
}

function seededSkillEntries(skillId: string, defaultContent: string): [string, string][] {
    return [['SKILL.md', defaultContent], ...Object.entries(seededSkillExtraFiles[skillId] ?? {})];
}

function seededSkillFilePath(input: {
    options: { skillsDir?: string };
    relativePath: string;
    skillId: string;
}) {
    return path.join(
        input.options.skillsDir ?? agentEngineSkillsDir,
        input.skillId,
        ...input.relativePath.split('/')
    );
}

export async function resetRuntimeSkillToDefault(
    skillId: string,
    options: { skillsDir?: string } = {}
) {
    if (isSeededSkillId(skillId)) {
        return await resetSeededSkill(skillId, options);
    }
    throw new Error('Only seeded skills have Grotto defaults.');
}

export function setRuntimeSkillEnabled(skillId: string, enabled: boolean, db: Database = getDb()) {
    const now = new Date().toISOString();
    const affectedAgents = enabled
        ? []
        : (db
              .prepare(
                  `SELECT agents.id, agents.name
                   FROM agent_skill_assignments
                   JOIN agents ON agents.id = agent_skill_assignments.agent_id
                   WHERE skill_id = $skillId AND enabled = 1
                   ORDER BY agents.name, agents.id`
              )
              .all(namedParams({ skillId })) as Array<{ id: string; name: string }>);
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare(
            `INSERT INTO skill_settings (skill_id, enabled, created_at, updated_at)
             VALUES ($skillId, $enabled, $now, $now)
             ON CONFLICT(skill_id) DO UPDATE SET
               enabled = excluded.enabled,
               updated_at = excluded.updated_at`
        ).run(namedParams({ enabled: enabled ? 1 : 0, now, skillId }));
        if (!enabled) {
            db.prepare('DELETE FROM agent_skill_assignments WHERE skill_id = $skillId').run(
                namedParams({ skillId })
            );
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
    publishSkillUpdated(skillId);
    return affectedAgents;
}

export function isRuntimeSkillEnabled(skillId: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT enabled FROM skill_settings WHERE skill_id = $skillId')
        .get(namedParams({ skillId })) as { enabled: 0 | 1 } | undefined;
    return row?.enabled !== 0;
}

export async function listRuntimeSkills(options: RuntimeSkillOptions = {}) {
    const skillsDir = options.skillsDir ?? agentEngineSkillsDir;
    const scanned = await scanInstalledSkillSummaries(skillsDir);
    const missingSeeded = Object.keys(seededSkillDefaults)
        .filter((skillId) => !scanned.some((skill) => skill.id === skillId))
        .map((skillId) => seededSkillSummary(skillsDir, skillId));
    const installedSkills = [...missingSeeded, ...scanned];
    const agent = options.agent;
    const agentInstalledSkills = agent
        ? installedSkills.map((skill) => ({
              ...skill,
              eligible: agent.enabledSkillIds.includes(skill.id),
          }))
        : installedSkills;
    return agentRuntimeSkillListSchema.parse({
        skills: agentInstalledSkills.sort((left, right) => left.name.localeCompare(right.name)),
    }).skills;
}

export async function getRuntimeSkill(
    skillId: string,
    options: RuntimeSkillOptions = {}
): Promise<AgentRuntimeSkill | null> {
    const normalized = normalizeRuntimeSkillId(skillId);
    if (!normalized) {
        return null;
    }

    const summary = (await listRuntimeSkills(options)).find((skill) => skill.id === normalized);
    if (!summary) {
        return null;
    }

    const seededDefault = seededSkillDefaults[summary.id];
    const contentMarkdown =
        seededDefault === undefined
            ? await readSkillMarkdown(summary)
            : await fs.readFile(summary.filePath ?? '', 'utf8').catch(() => seededDefault);
    if (contentMarkdown === null) {
        return null;
    }

    return agentRuntimeSkillSchema.parse({
        ...summary,
        contentMarkdown,
        files: summary.baseDir ? await listSkillFiles(summary.baseDir) : [],
        installSource: null,
    });
}

export async function readAssignedSkillBundles(
    agent: Pick<AgentRuntimeAgent, 'enabledSkillIds'> & Partial<Pick<AgentRuntimeAgent, 'id'>>,
    options: { skillsDir?: string } = {}
) {
    const bundles: AssignedSkillBundle[] = [];
    const seen = new Set<string>();

    for (const skillId of agent.enabledSkillIds) {
        if (seen.has(skillId)) {
            continue;
        }
        seen.add(skillId);
        const skill = await getRuntimeSkill(skillId, options);
        if (!skill || skill.disabled === true) {
            continue;
        }

        bundles.push({
            content: skill.contentMarkdown,
            description: skill.description ?? skill.name,
            files: skill.baseDir ? await readSkillTextFiles(skill.baseDir) : [],
            id: skill.id,
            name: skill.name,
            path: skill.filePath ?? null,
        });
    }

    if (agent.id && hasAgentHostToolGrant(agent.id, 'browser')) {
        bundles.push({
            content: browserSkillContent,
            description: 'Control the managed browser with agent-browser commands.',
            files: [],
            id: 'browser',
            name: 'Browser',
            path: null,
        });
    }
    return bundles;
}

async function scanInstalledSkillSummaries(skillsDir: string) {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => []);
    const summaries: AgentRuntimeSkillSummary[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        if (entry.name.startsWith('.')) {
            continue;
        }
        const skillId = normalizeRuntimeSkillId(entry.name);
        if (!skillId) {
            continue;
        }
        const baseDir = path.join(skillsDir, skillId);
        const filePath = path.join(baseDir, 'SKILL.md');
        const [content, stats] = await Promise.all([
            fs.readFile(filePath, 'utf8').catch(() => null),
            fs.stat(filePath).catch(() => null),
        ]);
        if (content === null) {
            continue;
        }
        summaries.push(
            skillSummaryFromMarkdown({
                baseDir,
                content,
                filePath,
                skillId,
                skillSource: tryReadSkillSummarySource(skillId),
                stats,
            })
        );
    }

    return summaries;
}

function skillSummaryFromMarkdown(input: {
    baseDir: string;
    content: string;
    filePath: string;
    skillId: string;
    skillSource: SkillSummarySource | null;
    stats: { mtime: Date } | null;
}) {
    const seeded = isSeededSkillId(input.skillId);
    const managedState = managedSkillSummaryState({
        content: input.content,
        defaultSeededContent: seededSkillDefaults[input.skillId] ?? defaultTavernSkill,
        seededSkillId: seeded ? input.skillId : tavernAgentSkillId,
        skillId: input.skillId,
        skillSource: input.skillSource,
    });
    return agentRuntimeSkillSummarySchema.parse({
        allowedTools: null,
        baseDir: input.baseDir,
        bundled: seeded,
        commandVisible: true,
        configChecks: [],
        description: readSkillDescription(input.content),
        disabled: !isRuntimeSkillEnabled(input.skillId),
        edited: managedState.edited,
        eligible: true,
        filePath: input.filePath,
        id: input.skillId,
        install: [],
        managedSource: managedState.managedSource,
        missing: emptyRequirements,
        modelVisible: true,
        name: input.skillId,
        primaryEnv: null,
        requirements: emptyRequirements,
        runtimeSource: seeded ? 'Agent engine' : 'Installed skill',
        skillKey: input.skillId,
        source: seeded ? 'builtin' : 'installed',
        updateAvailable: managedState.updateAvailable,
        updatedAt: input.stats?.mtime.toISOString() ?? null,
        userInvocable: true,
    });
}

function seededSkillSummary(skillsDir: string, skillId: string) {
    return skillSummaryFromMarkdown({
        baseDir: path.join(skillsDir, skillId),
        content: seededSkillDefaults[skillId],
        filePath: path.join(skillsDir, skillId, 'SKILL.md'),
        skillId,
        skillSource: {
            installedHash: sha256(seededSkillDefaults[skillId]),
            source: 'seeded',
        },
        stats: null,
    });
}

function recordSeededSkillSource(skillId: string) {
    tryRecordSkillSource({
        installedHash: sha256(seededSkillDefaults[skillId]),
        skillId,
        source: 'seeded',
    });
}

async function readSkillMarkdown(summary: AgentRuntimeSkillSummary) {
    if (!summary.filePath) {
        return null;
    }
    return await fs.readFile(summary.filePath, 'utf8').catch(() => null);
}

async function listSkillFiles(baseDir: string) {
    const files: AgentRuntimeSkillFile[] = [];
    await collectSkillFiles(baseDir, '', files);
    return normalizeAgentRuntimeSkillFiles(files);
}

async function readSkillTextFiles(baseDir: string) {
    const files = await listSkillFiles(baseDir);
    const textFiles: AssignedSkillFile[] = [];

    for (const file of files) {
        if (isReservedAgentRuntimeSkillFilePath(file.path)) {
            continue;
        }
        const content = await fs
            .readFile(path.join(baseDir, ...file.path.split('/')), 'utf8')
            .catch(() => null);
        if (content === null) {
            continue;
        }
        textFiles.push({
            content,
            path: file.path,
        });
    }

    return textFiles;
}

async function collectSkillFiles(
    baseDir: string,
    relativeDir: string,
    files: AgentRuntimeSkillFile[]
) {
    const dir = path.join(baseDir, relativeDir);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
        const relativePath = path.join(relativeDir, entry.name);
        if (entry.isDirectory()) {
            await collectSkillFiles(baseDir, relativePath, files);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        const stats = await fs.stat(path.join(baseDir, relativePath)).catch(() => null);
        if (stats) {
            files.push({
                path: relativePath.split(path.sep).join('/'),
                sizeBytes: stats.size,
            });
        }
    }
}

function readSkillDescription(content: string) {
    const metadata = readFrontmatter(content);
    const frontmatterDescription = metadata.description ?? metadata.summary;
    if (frontmatterDescription) {
        return frontmatterDescription;
    }

    const markdown = stripFrontmatter(content);
    const lines = markdown
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    return lines[0] ?? null;
}

function readFrontmatter(content: string) {
    if (!content.startsWith('---')) {
        return {};
    }
    const end = content.indexOf('\n---', 3);
    if (end === -1) {
        return {};
    }

    const metadata: Record<string, string> = {};
    const block = content.slice(3, end).split(/\r?\n/u);
    for (const line of block) {
        const match = /^(?<key>[A-Za-z][A-Za-z0-9_-]*):\s*(?<value>.+)$/u.exec(line.trim());
        if (match?.groups) {
            metadata[match.groups.key] = match.groups.value.replace(/^["']|["']$/gu, '').trim();
        }
    }
    return metadata;
}

function stripFrontmatter(content: string) {
    if (!content.startsWith('---')) {
        return content;
    }
    const end = content.indexOf('\n---', 3);
    return end === -1 ? content : content.slice(end + 4).trimStart();
}

export function normalizeRuntimeSkillId(value: string) {
    const normalized = value.trim().toLowerCase();
    return /^[a-z0-9][a-z0-9._-]*$/u.test(normalized) && !normalized.startsWith('.')
        ? normalized
        : null;
}
