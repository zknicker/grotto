import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { HarnessAgentSkill } from '@ai-sdk/harness/agent';

/**
 * Reads the Agent's canonical, writable skill library into the harness skill
 * contract — the exact set every executor sees (ADR 0019). Each immediate
 * subdirectory with a `SKILL.md` is one bundle; its description is the first
 * non-empty line and its supporting files ride along. This is the Computer's
 * boundary replacement for Runtime's DB-backed `readAssignedSkillBundles`:
 * ownership is the on-disk library, not a Server-assigned enable list.
 */
export async function readAgentSkills(skillsDir: string): Promise<HarnessAgentSkill[]> {
    let entries: string[];
    try {
        entries = await readdir(skillsDir);
    } catch {
        return [];
    }
    const skills: HarnessAgentSkill[] = [];
    for (const name of entries.sort()) {
        const skill = await readSkillBundle(join(skillsDir, name), name);
        if (skill) {
            skills.push(skill);
        }
    }
    return skills;
}

async function readSkillBundle(dir: string, name: string): Promise<HarnessAgentSkill | null> {
    let content: string;
    try {
        content = await readFile(join(dir, 'SKILL.md'), 'utf8');
    } catch {
        return null;
    }
    const files = await readSupportingFiles(dir);
    return {
        content,
        description: firstMeaningfulLine(content),
        ...(files.length > 0 ? { files } : {}),
        name,
    };
}

async function readSupportingFiles(dir: string) {
    const files: { content: string; path: string }[] = [];
    const walk = async (current: string) => {
        const entries = await readdir(current);
        for (const entry of entries) {
            const full = join(current, entry);
            const info = await stat(full);
            if (info.isDirectory()) {
                await walk(full);
            } else if (!(current === dir && entry === 'SKILL.md')) {
                files.push({ content: await readFile(full, 'utf8'), path: relative(dir, full) });
            }
        }
    };
    try {
        await walk(dir);
    } catch {
        return files;
    }
    return files;
}

function firstMeaningfulLine(content: string): string {
    for (const line of content.split('\n')) {
        const trimmed = line.replace(/^#+\s*/u, '').trim();
        if (trimmed) {
            return trimmed;
        }
    }
    return '';
}
