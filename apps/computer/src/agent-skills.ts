import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

const skillIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;
const supportRoots = new Set(['assets', 'references', 'scripts', 'templates']);

export async function listLocalAgentSkills(skillsDir: string) {
    const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
    const skills = await Promise.all(
        entries
            .filter((entry) => entry.isDirectory() && skillIdPattern.test(entry.name))
            .map(async (entry) => {
                const content = await readContainedSkill(skillsDir, entry.name);
                return content
                    ? {
                          description: descriptionOf(content),
                          id: entry.name,
                          name: entry.name,
                      }
                    : null;
            })
    );
    return { skills: skills.filter((skill) => skill !== null) };
}

export async function viewLocalAgentSkill(skillsDir: string, skillId: string) {
    const content = await requiredSkill(skillsDir, skillId);
    const skillDir = await containedSkillDir(skillsDir, skillId);
    const supportFiles = await listSupportFiles(skillDir);
    return {
        content,
        description: descriptionOf(content),
        hash: sha256(content),
        id: skillId,
        name: skillId,
        supportFiles,
    };
}

export async function createLocalAgentSkill(
    skillsDir: string,
    input: { content: string; description: string; name: string }
) {
    const skillId = skillIdFromName(input.name);
    const skillDir = resolve(skillsDir, skillId);
    assertWithin(resolve(skillsDir), skillDir);
    await mkdir(skillsDir, { mode: 0o700, recursive: true });
    await mkdir(skillDir);
    await writeFile(join(skillDir, 'SKILL.md'), input.content, { flag: 'wx', mode: 0o600 });
    return {
        skill: {
            description: input.description,
            id: skillId,
            name: skillId,
        },
    };
}

export async function patchLocalAgentSkill(
    skillsDir: string,
    input: { content: string; expectedHash: string; skillId: string }
) {
    const previous = await requiredSkill(skillsDir, input.skillId);
    const beforeHash = sha256(previous);
    if (beforeHash !== input.expectedHash) {
        throw new Error('Skill changed since it was read.');
    }
    await writeFile(
        join(await containedSkillDir(skillsDir, input.skillId), 'SKILL.md'),
        input.content
    );
    return {
        change: {
            afterHash: sha256(input.content),
            beforeHash,
            path: 'SKILL.md',
            skillId: input.skillId,
        },
    };
}

export async function writeLocalAgentSkillFile(
    skillsDir: string,
    input: {
        content: string;
        expectedHash: string | null;
        filePath: string;
        skillId: string;
    }
) {
    const skillDir = await containedSkillDir(skillsDir, input.skillId);
    const relativePath = normalizeSupportPath(input.filePath);
    const destination = resolve(skillDir, relativePath);
    assertWithin(skillDir, destination);
    await assertNoSymlinkPath(skillDir, destination);
    const previous = await readFile(destination, 'utf8').catch(() => null);
    const beforeHash = previous === null ? null : sha256(previous);
    if (beforeHash !== input.expectedHash) {
        throw new Error('Skill file changed since it was read.');
    }
    await mkdir(dirname(destination), { mode: 0o700, recursive: true });
    await writeFile(destination, input.content, { mode: 0o600 });
    return {
        change: {
            afterHash: sha256(input.content),
            beforeHash,
            path: relativePath,
            skillId: input.skillId,
        },
    };
}

export async function deleteLocalAgentSkill(skillsDir: string, agentId: string, skillId: string) {
    await requiredSkill(skillsDir, skillId);
    await rm(await containedSkillDir(skillsDir, skillId), { recursive: true });
    return { deleted: { agentId, skillId } };
}

async function requiredSkill(skillsDir: string, skillId: string) {
    const content = await readContainedSkill(skillsDir, skillId);
    if (content === null) {
        throw new Error(`Skill not found: ${skillId}`);
    }
    return content;
}

async function readContainedSkill(skillsDir: string, skillId: string) {
    const dir = await containedSkillDir(skillsDir, skillId).catch(() => null);
    return dir ? await readFile(join(dir, 'SKILL.md'), 'utf8').catch(() => null) : null;
}

async function containedSkillDir(skillsDir: string, skillId: string) {
    if (!skillIdPattern.test(skillId)) {
        throw new Error('Skill id is invalid.');
    }
    const root = await realpath(skillsDir);
    const dir = await realpath(join(root, skillId));
    assertWithin(root, dir);
    return dir;
}

async function listSupportFiles(skillDir: string) {
    const files: { hash: string; path: string }[] = [];
    const walk = async (dir: string) => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isSymbolicLink()) {
                continue;
            }
            if (entry.isDirectory()) {
                await walk(full);
            } else if (basename(full) !== 'SKILL.md') {
                const content = await readFile(full);
                files.push({ hash: sha256(content), path: relative(skillDir, full) });
            }
        }
    };
    await walk(skillDir);
    return files;
}

async function assertNoSymlinkPath(root: string, destination: string) {
    let current = dirname(destination);
    while (current !== root) {
        const info = await lstat(current).catch(() => null);
        if (info?.isSymbolicLink()) {
            throw new Error('Skill file path may not traverse a symlink.');
        }
        current = dirname(current);
    }
}

function normalizeSupportPath(path: string) {
    const normalized = path.replaceAll('\\', '/').replace(/^\.\//u, '');
    const [root] = normalized.split('/');
    if (
        !(root && supportRoots.has(root)) ||
        normalized.includes('..') ||
        normalized.endsWith('/')
    ) {
        throw new Error(
            'Skill files must stay under assets/, references/, scripts/, or templates/.'
        );
    }
    return normalized;
}

function skillIdFromName(name: string) {
    const id = name
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9_-]+/gu, '-')
        .replaceAll(/^-+|-+$/gu, '');
    if (!skillIdPattern.test(id)) {
        throw new Error('Skill name is invalid.');
    }
    return id;
}

function descriptionOf(content: string) {
    return (
        content
            .split('\n')
            .map((line) => line.replace(/^#+\s*/u, '').trim())
            .find(Boolean) ?? 'Agent skill'
    );
}

function assertWithin(root: string, target: string) {
    const path = relative(root, target);
    if (!path || path.startsWith('..') || resolve(root, path) !== target) {
        throw new Error('Skill path escapes the Agent skill library.');
    }
}

function sha256(content: string | Uint8Array) {
    return createHash('sha256').update(content).digest('hex');
}
