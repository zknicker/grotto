import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

export type SkillSource = 'agent' | 'external' | 'hub' | 'seeded';

export interface SkillSnapshot {
    content: string;
    hash: string;
    skillId: string;
}

export interface SkillFileChange {
    afterHash: string;
    beforeHash: string | null;
    path: string;
    skillId: string;
}

interface SkillSourceRow {
    created_by_agent_id: string | null;
    installed_hash: string | null;
    source: SkillSource;
    updated_at: string;
}

const writableSource = 'agent' satisfies SkillSource;
const supportDirectories = ['assets', 'references', 'scripts', 'templates'] as const;
const canonicalSkillIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;

export function readSkillSource(skillId: string, db: Database = getDb()) {
    const row = db
        .prepare(
            `SELECT source, created_by_agent_id, installed_hash, updated_at
             FROM skill_sources
             WHERE skill_id = $skillId`
        )
        .get(namedParams({ skillId })) as SkillSourceRow | null;

    return row
        ? {
              createdByAgentId: row.created_by_agent_id,
              installedHash: row.installed_hash,
              source: row.source,
              updatedAt: row.updated_at,
          }
        : null;
}

export function resolveSkillSource(skillId: string, db: Database = getDb()): SkillSource {
    return readSkillSource(skillId, db)?.source ?? 'external';
}

export function recordSkillSource(input: {
    createdByAgentId?: string | null;
    db?: Database;
    installedHash?: string | null;
    skillId: string;
    source: SkillSource;
}) {
    const db = input.db ?? getDb();
    const now = new Date().toISOString();
    if ('installedHash' in input) {
        db.prepare(
            `INSERT INTO skill_sources
             (skill_id, source, created_by_agent_id, installed_hash, created_at, updated_at)
             VALUES ($skillId, $source, $createdByAgentId, $installedHash, $now, $now)
             ON CONFLICT(skill_id) DO UPDATE SET
               source = excluded.source,
               created_by_agent_id = excluded.created_by_agent_id,
               installed_hash = excluded.installed_hash,
               updated_at = excluded.updated_at`
        ).run(
            namedParams({
                createdByAgentId: input.createdByAgentId ?? null,
                installedHash: input.installedHash ?? null,
                now,
                skillId: input.skillId,
                source: input.source,
            })
        );
        return;
    }

    db.prepare(
        `INSERT INTO skill_sources
         (skill_id, source, created_by_agent_id, created_at, updated_at)
         VALUES ($skillId, $source, $createdByAgentId, $now, $now)
         ON CONFLICT(skill_id) DO UPDATE SET
           source = excluded.source,
           created_by_agent_id = excluded.created_by_agent_id,
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
            createdByAgentId: input.createdByAgentId ?? null,
            now,
            skillId: input.skillId,
            source: input.source,
        })
    );
}

export function tryRecordSkillSource(input: {
    createdByAgentId?: string | null;
    installedHash?: string | null;
    skillId: string;
    source: SkillSource;
}) {
    try {
        recordSkillSource(input);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Database not initialized')) {
            return;
        }
        throw error;
    }
}

export function deleteSkillSource(skillId: string, db: Database = getDb()) {
    db.prepare('DELETE FROM skill_sources WHERE skill_id = $skillId').run(namedParams({ skillId }));
}

export async function readSkillMarkdownSnapshot(input: {
    skillId: string;
    skillsDir: string;
}): Promise<SkillSnapshot | null> {
    const filePath = await containedSkillMarkdownPath(input);
    if (!filePath) {
        return null;
    }
    const content = await fs.readFile(filePath, 'utf8').catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    return content === null ? null : { content, hash: sha256(content), skillId: input.skillId };
}

export async function createAgentSkill(input: {
    agentId: string | null;
    content: string;
    description: string;
    name: string;
    skillsDir: string;
}) {
    const skillId = skillIdFromName(input.name);
    const skillDir = path.join(input.skillsDir, skillId);
    if (await skillExists(skillDir)) {
        throw new Error(`Skill already exists: ${skillId}`);
    }

    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), input.content, {
        flag: 'wx',
        mode: 0o600,
    });
    recordSkillSource({
        createdByAgentId: input.agentId,
        skillId,
        source: writableSource,
    });
    if (input.agentId) {
        enableSkillForAgent({ agentId: input.agentId, skillId });
    }

    return {
        description: input.description,
        id: skillId,
        name: skillId,
        source: writableSource,
        writable: true,
    };
}

export async function patchSkillMarkdown(input: {
    content: string;
    expectedHash: string;
    skillId: string;
    skillsDir: string;
}) {
    const filePath = await containedSkillMarkdownPath(input);
    if (!filePath) {
        throw new Error(`Skill not found: ${input.skillId}`);
    }
    const previous = await fs.readFile(filePath, 'utf8').catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    if (previous === null) {
        throw new Error(`Skill not found: ${input.skillId}`);
    }
    const beforeHash = sha256(previous);
    if (beforeHash !== input.expectedHash) {
        throw new Error('Skill changed since it was read.');
    }

    await fs.writeFile(filePath, input.content);
    return {
        afterHash: sha256(input.content),
        beforeHash,
        path: 'SKILL.md',
        skillId: input.skillId,
    };
}

export async function writeSkillSupportFile(input: {
    content: string;
    expectedHash: string | null;
    filePath: string;
    skillId: string;
    skillsDir: string;
}): Promise<SkillFileChange> {
    const skillDir = await containedSkillDir(input);
    if (!(skillDir && (await skillExists(skillDir)))) {
        throw new Error(`Skill not found: ${input.skillId}`);
    }
    const relativePath = normalizeSupportFilePath(input.filePath);
    const absolutePath = await resolveSkillWritePath({
        relativePath,
        skillDir,
    });
    const previous = await fs.readFile(absolutePath, 'utf8').catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    const beforeHash = previous === null ? null : sha256(previous);
    if (beforeHash !== input.expectedHash) {
        throw new Error('Skill file changed since it was read.');
    }

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.content, { mode: 0o600 });
    return {
        afterHash: sha256(input.content),
        beforeHash,
        path: relativePath,
        skillId: input.skillId,
    };
}

export async function listSkillSupportFileSnapshots(input: { skillId: string; skillsDir: string }) {
    const skillDir = await containedSkillDir(input);
    if (!skillDir) {
        return [];
    }
    const files: Array<{ hash: string; path: string }> = [];
    for (const directory of supportDirectories) {
        await collectSupportFiles(path.join(skillDir, directory), directory, files);
    }
    return files.sort((left, right) => left.path.localeCompare(right.path));
}

export function skillIdFromName(name: string) {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '');
    if (!slug) {
        throw new Error('Skill name must contain letters or numbers.');
    }
    return slug;
}

export function assertCanonicalSkillId(skillId: string) {
    if (!canonicalSkillIdPattern.test(skillId)) {
        throw new Error(
            'Skill id must be one path segment containing only letters, numbers, underscores, or hyphens.'
        );
    }
}

export async function skillPackageIsContained(input: {
    skillId: string;
    skillsDir: string;
}): Promise<boolean> {
    return (await containedSkillMarkdownPath(input)) !== null;
}

export function sha256(content: string) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function enableSkillForAgent(input: { agentId: string; skillId: string }) {
    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO agent_skill_assignments
             (agent_id, skill_id, enabled, created_at, updated_at)
             VALUES ($agentId, $skillId, 1, $now, $now)
             ON CONFLICT(agent_id, skill_id) DO UPDATE SET
               enabled = 1,
               updated_at = excluded.updated_at`
        )
        .run(namedParams({ agentId: input.agentId, now, skillId: input.skillId }));
}

async function skillExists(skillDir: string) {
    const stat = await fs.stat(path.join(skillDir, 'SKILL.md')).catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    return stat?.isFile() === true;
}

function normalizeSupportFilePath(filePath: string) {
    if (
        filePath.includes('\\') ||
        path.isAbsolute(filePath) ||
        filePath.split('/').includes('..')
    ) {
        throw new Error('Skill support file path must stay inside the skill package.');
    }
    if (!supportDirectories.some((directory) => filePath.startsWith(`${directory}/`))) {
        throw new Error(
            'Skill support file path must start with references/, templates/, scripts/, or assets/.'
        );
    }
    const normalized = path.posix.normalize(filePath);
    if (normalized !== filePath || normalized === '.' || normalized.endsWith('/')) {
        throw new Error('Skill support file path must name a file.');
    }
    return normalized;
}

async function containedSkillMarkdownPath(input: {
    skillId: string;
    skillsDir: string;
}): Promise<string | null> {
    const skillDir = await containedSkillDir(input);
    if (!skillDir) {
        return null;
    }
    const markdownPath = await fs.realpath(path.join(skillDir, 'SKILL.md')).catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    if (!markdownPath) {
        return null;
    }
    assertPathContained(skillDir, markdownPath);
    return markdownPath;
}

async function containedSkillDir(input: {
    skillId: string;
    skillsDir: string;
}): Promise<string | null> {
    assertCanonicalSkillId(input.skillId);
    const skillsDir = await fs.realpath(input.skillsDir).catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    if (!skillsDir) {
        return null;
    }
    const unresolvedSkillDir = path.join(skillsDir, input.skillId);
    const stats = await fs.lstat(unresolvedSkillDir).catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    if (!stats) {
        return null;
    }
    if (stats.isSymbolicLink()) {
        throw new Error('Skill package root must not be a symbolic link.');
    }
    const skillDir = await fs.realpath(unresolvedSkillDir);
    assertPathContained(skillsDir, skillDir);
    return skillDir;
}

async function resolveSkillWritePath(input: { relativePath: string; skillDir: string }) {
    const absolutePath = path.resolve(input.skillDir, ...input.relativePath.split('/'));
    assertPathContained(input.skillDir, absolutePath);
    const existing = await fs.realpath(absolutePath).catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    if (existing) {
        assertPathContained(input.skillDir, existing);
        return existing;
    }
    const stats = await fs.lstat(absolutePath).catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    if (stats?.isSymbolicLink()) {
        throw new Error('Skill support file path must stay inside the skill package.');
    }
    await assertSkillAncestorsContained(input.skillDir, path.dirname(absolutePath));
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    const parent = await fs.realpath(path.dirname(absolutePath));
    assertPathContained(input.skillDir, parent);
    return path.join(parent, path.basename(absolutePath));
}

async function assertSkillAncestorsContained(skillDir: string, directory: string) {
    let candidate = directory;
    while (true) {
        const resolved = await fs.realpath(candidate).catch((error) => {
            if (isNotFoundError(error)) {
                return null;
            }
            throw error;
        });
        if (resolved) {
            assertPathContained(skillDir, resolved);
        }
        if (candidate === skillDir) {
            return;
        }
        const parent = path.dirname(candidate);
        if (parent === candidate) {
            throw new Error('Skill support file path must stay inside the skill package.');
        }
        candidate = parent;
    }
}

function assertPathContained(parent: string, child: string) {
    if (!(child === parent || child.startsWith(`${parent}${path.sep}`))) {
        throw new Error('Skill path must stay inside the skills directory.');
    }
}

async function collectSupportFiles(
    absoluteDir: string,
    relativeDir: string,
    files: Array<{ hash: string; path: string }>
) {
    const entries = await fs.readdir(absoluteDir, { withFileTypes: true }).catch((error) => {
        if (isNotFoundError(error)) {
            return [];
        }
        throw error;
    });

    for (const entry of entries) {
        const relativePath = `${relativeDir}/${entry.name}`;
        const absolutePath = path.join(absoluteDir, entry.name);
        if (entry.isDirectory()) {
            await collectSupportFiles(absolutePath, relativePath, files);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        const content = await fs.readFile(absolutePath, 'utf8').catch(() => null);
        if (content !== null) {
            files.push({ hash: sha256(content), path: relativePath });
        }
    }
}

function isNotFoundError(error: unknown) {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
