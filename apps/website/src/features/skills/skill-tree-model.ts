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
    dependencyState: 'missing' | 'ready' | 'unknown';
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

export function buildSkillTreePaths(subjects: SkillTreeSubject[]) {
    const paths = new Set<string>();
    for (const subject of subjects) {
        addFolderAncestors(paths, subject.treePath);
        paths.add(subject.treePath);
    }
    return [...paths];
}

function addFolderAncestors(paths: Set<string>, path: string) {
    const segments = path.split('/').filter(Boolean);
    for (let index = 0; index < segments.length - 1; index += 1) {
        paths.add(`${segments.slice(0, index + 1).join('/')}/`);
    }
}
