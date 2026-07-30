import type { FileTreeSortEntry } from '@pierre/trees';
import type { HostedWorkspaceFileEntry } from '@tavern/api';

export type WorkspaceFileEntry = HostedWorkspaceFileEntry;
export type WorkspaceDirectoryEntries = Record<string, WorkspaceFileEntry[]>;

export function buildWorkspaceTreePaths(entriesByDirectory: WorkspaceDirectoryEntries) {
    const paths = new Set<string>();

    for (const [directoryPath, entries] of Object.entries(entriesByDirectory)) {
        if (directoryPath) {
            addFolderAncestors(paths, toTreeFolderPath(directoryPath));
            paths.add(toTreeFolderPath(directoryPath));
        }

        for (const entry of entries) {
            const treePath = toTreeEntryPath(entry);
            addFolderAncestors(paths, treePath);
            paths.add(treePath);
        }
    }

    return [...paths];
}

export function filterWorkspaceTreePaths(paths: string[], query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return paths;
    }

    const filteredPaths = new Set<string>();
    for (const path of paths) {
        if (!path.toLowerCase().includes(normalizedQuery)) {
            continue;
        }
        addFolderAncestors(filteredPaths, path);
        filteredPaths.add(path);
    }

    return paths.filter((path) => filteredPaths.has(path));
}

export function addFolderAncestors(paths: Set<string>, path: string) {
    const segments = path.split('/').filter(Boolean);
    const folderSegments = isTreeFolderPath(path) ? segments : segments.slice(0, -1);
    for (let index = 0; index < folderSegments.length; index += 1) {
        paths.add(`${segments.slice(0, index + 1).join('/')}/`);
    }
}

export function folderAncestors(treePath: string) {
    const ancestors = new Set<string>();
    addFolderAncestors(ancestors, treePath);
    return [...ancestors];
}

export function toTreeEntryPath(entry: WorkspaceFileEntry) {
    return entry.kind === 'directory' ? toTreeFolderPath(entry.path) : toTreeFilePath(entry.path);
}

export function toTreeFilePath(path: string) {
    return normalizeWorkspacePath(path);
}

export function toTreeFolderPath(path: string) {
    const normalized = normalizeWorkspacePath(path);
    return normalized ? `${normalized}/` : '';
}

export function fromTreeFolderPath(path: string) {
    return trimTreeFolderSlash(normalizeWorkspacePath(path));
}

export function normalizeWorkspacePath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}

function trimTreeFolderSlash(path: string) {
    return path.replace(/\/+$/u, '');
}

export function isTreeFolderPath(path: string) {
    return path.endsWith('/');
}

export function compareFileTreeEntries(left: FileTreeSortEntry, right: FileTreeSortEntry) {
    if (left.isDirectory !== right.isDirectory) {
        return left.isDirectory ? -1 : 1;
    }
    return left.basename.localeCompare(right.basename, undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}
