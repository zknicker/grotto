import { createHash, randomBytes } from 'node:crypto';
import {
    lstat,
    mkdir,
    readdir,
    readFile,
    realpath,
    rename,
    rm,
    stat,
    writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import type {
    HostedAgentSkillImportCommand,
    HostedAgentSkillMetadata,
    HostedImportableSkill,
} from '@tavern/api';

const skillNamePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;

interface HostSkillSource extends HostedImportableSkill {
    directory: string;
}

export function parseAgentSkillImportCommand(frame: unknown): HostedAgentSkillImportCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'agent-skill-import' ||
        ![frame.agentId, frame.requestId, frame.sourceId].every(isHostedId)
    ) {
        return null;
    }
    return frame as unknown as HostedAgentSkillImportCommand;
}

export async function listImportableSkills(
    roots = defaultImportRoots()
): Promise<HostedImportableSkill[]> {
    return (await scanHostSkills(roots)).map(({ directory: _, ...metadata }) => metadata);
}

export async function listAgentSkillReports(dataRoot: string, serverId: string) {
    const agentsRoot = join(dataRoot, 'servers', serverId, 'agents');
    const agents = await readdir(agentsRoot, { withFileTypes: true }).catch(() => []);
    return await Promise.all(
        agents
            .filter((entry) => entry.isDirectory() && isHostedId(entry.name))
            .sort((left, right) => left.name.localeCompare(right.name))
            .map(async (entry) => ({
                agentId: entry.name,
                skills: await listSkillMetadata(join(agentsRoot, entry.name, 'skills')),
            }))
    );
}

export async function importHostSkill(input: {
    agentId: string;
    dataRoot: string;
    roots?: string[];
    serverId: string;
    sourceId: string;
}): Promise<HostedAgentSkillMetadata> {
    const source = (await scanHostSkills(input.roots ?? defaultImportRoots())).find(
        (candidate) => candidate.id === input.sourceId
    );
    if (!source) {
        throw new Error('That host skill is no longer available.');
    }
    const skillsDir = join(
        input.dataRoot,
        'servers',
        input.serverId,
        'agents',
        input.agentId,
        'skills'
    );
    await mkdir(skillsDir, { mode: 0o700, recursive: true });
    const destination = join(skillsDir, source.name);
    if (await lstat(destination).catch(() => null)) {
        throw new Error(`The Agent already has a skill named "${source.name}".`);
    }
    const temporary = join(skillsDir, `.import-${randomBytes(8).toString('hex')}`);
    await mkdir(temporary, { mode: 0o700 });
    try {
        await copyBundle(source.directory, temporary);
        await rename(temporary, destination);
    } catch (error) {
        await rm(temporary, { force: true, recursive: true });
        throw error;
    }
    const [metadata] = await listSkillMetadata(skillsDir, source.name);
    if (!metadata) {
        throw new Error('The imported skill could not be verified.');
    }
    return metadata;
}

async function scanHostSkills(roots: string[]): Promise<HostSkillSource[]> {
    const seen = new Set<string>();
    const found: HostSkillSource[] = [];
    for (const root of roots) {
        const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (entry.name.length > 128 || !skillNamePattern.test(entry.name)) {
                continue;
            }
            const candidate = join(root, entry.name);
            const directory = await realpath(candidate).catch(() => null);
            const info = directory ? await stat(directory).catch(() => null) : null;
            if (!(directory && info?.isDirectory()) || seen.has(directory)) {
                continue;
            }
            const content = await readFile(join(directory, 'SKILL.md'), 'utf8').catch(() => null);
            if (content === null) {
                continue;
            }
            seen.add(directory);
            found.push({
                description: descriptionOf(content),
                directory,
                id: sourceId(directory),
                name: entry.name,
                source: shortPath(candidate),
            });
        }
    }
    return found.sort(
        (left, right) =>
            left.name.localeCompare(right.name) || left.source.localeCompare(right.source)
    );
}

async function listSkillMetadata(
    skillsDir: string,
    onlyName?: string
): Promise<HostedAgentSkillMetadata[]> {
    const entries = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
    const metadata = await Promise.all(
        entries
            .filter(
                (entry) =>
                    entry.isDirectory() &&
                    entry.name.length <= 128 &&
                    skillNamePattern.test(entry.name) &&
                    (!onlyName || entry.name === onlyName)
            )
            .map(async (entry) => {
                const directory = join(skillsDir, entry.name);
                const content = await readFile(join(directory, 'SKILL.md'), 'utf8').catch(
                    () => null
                );
                if (content === null) {
                    return null;
                }
                const files = await bundleFiles(directory);
                const modifiedAt = new Date(
                    Math.max(...files.map((file) => file.modifiedAt))
                ).toISOString();
                const hash = createHash('sha256');
                for (const file of files) {
                    hash.update(file.path);
                    hash.update(file.content);
                }
                return {
                    description: descriptionOf(content),
                    hash: hash.digest('hex'),
                    modifiedAt,
                    name: entry.name,
                };
            })
    );
    return metadata
        .filter((item): item is HostedAgentSkillMetadata => item !== null)
        .sort((left, right) => left.name.localeCompare(right.name));
}

async function bundleFiles(root: string) {
    const files: { content: Uint8Array; modifiedAt: number; path: string }[] = [];
    const walk = async (directory: string) => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isSymbolicLink()) {
                continue;
            }
            if (entry.isDirectory()) {
                await walk(path);
                continue;
            }
            if (entry.isFile()) {
                const info = await stat(path);
                files.push({
                    content: await readFile(path),
                    modifiedAt: info.mtimeMs,
                    path: relative(root, path),
                });
            }
        }
    };
    await walk(root);
    return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function copyBundle(source: string, destination: string) {
    for (const entry of await readdir(source, { withFileTypes: true })) {
        const from = join(source, entry.name);
        const to = join(destination, entry.name);
        if (entry.isSymbolicLink()) {
            continue;
        }
        if (entry.isDirectory()) {
            await mkdir(to, { mode: 0o700 });
            await copyBundle(from, to);
        } else if (entry.isFile()) {
            const info = await stat(from);
            await writeFile(to, await readFile(from), {
                mode: info.mode & 0o111 ? 0o700 : 0o600,
            });
        }
    }
}

function defaultImportRoots() {
    const home = homedir();
    return [
        join(home, '.agents', 'skills'),
        join(home, '.claude', 'skills'),
        join(home, '.codex', 'skills'),
    ];
}

function descriptionOf(content: string) {
    const frontmatter = content.match(/^---\n[\s\S]*?\n---/u)?.[0];
    const described = frontmatter?.match(/^(?:description|summary):\s*(.+)$/mu)?.[1]?.trim();
    return (
        described ??
        content
            .split('\n')
            .map((line) => line.replace(/^#+\s*/u, '').trim())
            .find((line) => Boolean(line) && line !== '---') ??
        'Agent skill'
    ).slice(0, 500);
}

function sourceId(path: string) {
    return `hsk_${createHash('sha256').update(path).digest('base64url').slice(0, 16)}`;
}

function shortPath(path: string) {
    const home = homedir();
    return path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}

function isHostedId(value: unknown) {
    return typeof value === 'string' && /^[a-z]+_[A-Za-z0-9_-]{16}$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
