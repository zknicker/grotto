import type { SkillListOutput } from '../../lib/trpc.tsx';

type SkillSummary = SkillListOutput['skills'][number];
export type ManagedSource = 'hub' | 'seeded';
export interface HubEntry {
    edited: boolean;
    identifier: string;
    trustLevel: null | string;
    updateAvailable: boolean;
}
export type HubByName = Map<string, HubEntry>;

/** Runtime-owned managed-skill flags keyed by skill name. */
export interface RuntimeManagedFlags {
    edited?: boolean;
    managedSource?: ManagedSource | null;
    updateAvailable?: boolean;
}
export type RuntimeManagedByName = Map<string, RuntimeManagedFlags>;

export interface SkillTreeSubject {
    dependencyState: SkillSummary['dependencyState'];
    description: null | string;
    diagnostic: null | string;
    edited: boolean;
    enabled?: boolean;
    identifier: null | string;
    installed: boolean;
    managedSource: ManagedSource | null;
    name: string;
    readOnly: boolean;
    skillId: null | string;
    sourceLabel: string;
    treePath: string;
    trustLevel?: 'builtin' | 'community' | 'trusted';
    uninstallName: null | string;
    updateAvailable: boolean;
    updatedAt: null | string;
}

export function buildSkillTreeSubjects(input: {
    hubByName: HubByName;
    runtimeByName?: RuntimeManagedByName;
    skills: SkillSummary[];
}) {
    const runtimeByName = input.runtimeByName ?? new Map();

    return input.skills.map((skill) => installedTreeSubject(skill, input.hubByName, runtimeByName));
}

export function buildSkillTreePaths(subjects: SkillTreeSubject[]) {
    const paths = new Set<string>();
    for (const subject of subjects) {
        addFolderAncestors(paths, subject.treePath);
        paths.add(subject.treePath);
    }
    return [...paths];
}

function installedTreeSubject(
    skill: SkillSummary,
    hubByName: HubByName,
    runtimeByName: RuntimeManagedByName
): SkillTreeSubject {
    const hubEntry = hubByName.get(skill.name);
    const managed = resolveManagedFlags(runtimeByName.get(skill.name), hubEntry);

    return {
        dependencyState: skill.dependencyState,
        description: skill.description,
        diagnostic: skill.diagnostic,
        edited: managed.edited,
        enabled: skill.enabled,
        identifier: hubEntry?.identifier ?? null,
        installed: true,
        managedSource: managed.managedSource,
        name: skill.name,
        readOnly: skill.readOnly,
        skillId: skill.id,
        sourceLabel: 'Installed',
        treePath: skillFilePath(skill.name),
        trustLevel: narrowTrustLevel(hubEntry?.trustLevel),
        uninstallName: hubEntry ? skill.name : null,
        updateAvailable: managed.updateAvailable,
        updatedAt: skill.updatedAt,
    };
}

/**
 * Prefer runtime-owned managed flags; fall back to the hub entry when the
 * runtime summary omits a field so hub-installed skills keep working.
 */
function resolveManagedFlags(
    runtime: RuntimeManagedFlags | undefined,
    hubEntry: HubEntry | undefined
) {
    return {
        edited: runtime?.edited ?? hubEntry?.edited ?? false,
        managedSource: runtime?.managedSource ?? (hubEntry ? 'hub' : null),
        updateAvailable: runtime?.updateAvailable ?? hubEntry?.updateAvailable ?? false,
    };
}

function skillFilePath(name: string) {
    return `${normalizeTreePath(name)}/SKILL.md`;
}

function normalizeTreePath(value: string) {
    return value
        .trim()
        .replace(/\\/gu, '/')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join('/');
}

function addFolderAncestors(paths: Set<string>, path: string) {
    const segments = path.split('/').filter(Boolean);
    for (let index = 0; index < segments.length - 1; index += 1) {
        paths.add(`${segments.slice(0, index + 1).join('/')}/`);
    }
}

function narrowTrustLevel(value: null | string | undefined) {
    return value === 'builtin' || value === 'community' || value === 'trusted' ? value : undefined;
}
