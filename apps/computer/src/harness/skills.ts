import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { HarnessAgentSkill } from '@ai-sdk/harness/agent';

/**
 * Reads the Agent's canonical, writable skill library into the harness skill
 * contract — the exact set every executor sees (ADR 0019). Each immediate
 * subdirectory with a `SKILL.md` is one bundle; its listing name and
 * description come from the file's YAML frontmatter when it has one, and its
 * supporting files ride along. This is the Computer's boundary replacement for
 * Runtime's DB-backed `readAssignedSkillBundles`: ownership is the on-disk
 * library, not a Server-assigned enable list.
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
    const { body, fields } = parseFrontmatter(content);
    const files = await readSupportingFiles(dir);
    return {
        // The whole file stays the skill content; adapters wrap it with their
        // own frontmatter built from `name` and `description`.
        content,
        description: yamlSafeScalar(fields.description ?? firstMeaningfulLine(body)),
        ...(files.length > 0 ? { files } : {}),
        name: isSkillName(fields.name) ? fields.name : name,
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

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/u;
const FIELD = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/u;
const BLOCK_SCALAR = /^[>|][-+\d]*$/u;

/** Splits a leading `---` frontmatter block from the markdown that follows it. */
function parseFrontmatter(content: string): {
    body: string;
    fields: Record<string, string>;
} {
    const match = FRONTMATTER.exec(content);
    if (!match?.[1]) {
        return { body: content, fields: {} };
    }
    return { body: content.slice(match[0].length), fields: parseFields(match[1]) };
}

/**
 * Reads the flat scalar fields a skill listing needs. Supports plain, quoted,
 * and `>`/`|` block values; nested mappings and sequences are skipped because
 * no listing field uses one.
 */
function parseFields(block: string): Record<string, string> {
    const lines = block.split('\n');
    const fields: Record<string, string> = {};
    for (let index = 0; index < lines.length; index += 1) {
        const field = FIELD.exec(lines[index] ?? '');
        if (!field?.[1]) {
            continue;
        }
        const raw = (field[2] ?? '').trim();
        if (BLOCK_SCALAR.test(raw)) {
            const collected: string[] = [];
            while (index + 1 < lines.length) {
                const next = lines[index + 1] ?? '';
                if (next.trim() !== '' && !/^[ \t]/u.test(next)) {
                    break;
                }
                index += 1;
                if (next.trim() !== '') {
                    collected.push(next.trim());
                }
            }
            fields[field[1]] = collected.join(' ');
            continue;
        }
        fields[field[1]] = unquote(raw);
    }
    return fields;
}

function unquote(value: string): string {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replaceAll('\\"', '"').replaceAll('\\\\', '\\');
    }
    if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1).replaceAll("''", "'");
    }
    return value;
}

const UNSAFE_PLAIN = /^[\s\-?:,[\]{}#&*!|>'"%@`]|:\s|:$|\s#|\s$|[\n\r]/u;

/**
 * Every harness adapter renders a skill as `description: <value>` inside YAML
 * frontmatter without quoting it, so a description carrying `: ` or a trailing
 * comment marker would make the written `SKILL.md` unparseable and drop the
 * skill entirely. Quote those; the runtime still reads the authored text.
 */
function yamlSafeScalar(value: string): string {
    if (value === '' || !UNSAFE_PLAIN.test(value)) {
        return value;
    }
    return JSON.stringify(value);
}

function isSkillName(value: string | undefined): value is string {
    return (
        value !== undefined && value !== '.' && value !== '..' && /^[A-Za-z0-9._-]+$/u.test(value)
    );
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
