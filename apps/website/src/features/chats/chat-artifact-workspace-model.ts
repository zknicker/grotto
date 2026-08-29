import type { WorkspaceFileEntry as ServerWorkspaceFileEntry } from '@grotto/api';

export type WorkspaceFileEntry = ServerWorkspaceFileEntry;
export type WorkspaceDirectoryEntries = Record<string, WorkspaceFileEntry[]>;

/**
 * One row of the workspace browser, in the nested shape HeroUI's FileTree
 * renders. Directories always carry a `children` array, and an empty one means
 * "not listed yet" rather than "empty on disk" — the workspace loads one
 * directory at a time, so leaf-ness is decided by `kind`, never by child count.
 */
export interface WorkspaceTreeNode {
    children?: WorkspaceTreeNode[];
    id: string;
    kind: 'directory' | 'file';
    name: string;
}

/**
 * Folds the per-directory listings we have fetched so far into one tree.
 * Ancestors are synthesized from the entry paths themselves, so a directory
 * loaded directly (an `initialDirectoryPath` deep in the workspace) still hangs
 * off a spine of folders instead of appearing at the root.
 */
export function buildWorkspaceTree(
    entriesByDirectory: WorkspaceDirectoryEntries
): WorkspaceTreeNode[] {
    const roots: WorkspaceTreeNode[] = [];
    const nodesByPath = new Map<string, WorkspaceTreeNode>();

    const ensureDirectory = (path: string): WorkspaceTreeNode | null => {
        if (!path) {
            return null;
        }
        const existing = nodesByPath.get(path);
        if (existing) {
            return existing;
        }
        const segments = path.split('/');
        const parent = ensureDirectory(segments.slice(0, -1).join('/'));
        const node: WorkspaceTreeNode = {
            children: [],
            id: path,
            kind: 'directory',
            name: segments.at(-1) ?? path,
        };
        nodesByPath.set(path, node);
        (parent?.children ?? roots).push(node);
        return node;
    };

    for (const [directoryPath, entries] of Object.entries(entriesByDirectory)) {
        ensureDirectory(normalizeWorkspacePath(directoryPath));
        for (const entry of entries) {
            const path = normalizeWorkspacePath(entry.path);
            if (!path || nodesByPath.has(path)) {
                continue;
            }
            if (entry.kind === 'directory') {
                ensureDirectory(path);
                continue;
            }
            const segments = path.split('/');
            const parent = ensureDirectory(segments.slice(0, -1).join('/'));
            const node: WorkspaceTreeNode = {
                id: path,
                kind: 'file',
                name: entry.name || (segments.at(-1) ?? path),
            };
            nodesByPath.set(path, node);
            (parent?.children ?? roots).push(node);
        }
    }

    sortWorkspaceNodes(roots);
    return roots;
}

/**
 * Prunes the tree to the query. A node whose own path matches keeps its whole
 * subtree — every descendant path contains the matched ancestor segment anyway,
 * so pruning them would contradict the match that kept the folder.
 */
export function filterWorkspaceTree(nodes: WorkspaceTreeNode[], query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery ? pruneWorkspaceNodes(nodes, normalizedQuery) : nodes;
}

/** The expansion set of a workspace browser showing nothing but its root. */
/**
 * The synthetic "Workspace" root the tree renders above the real entries —
 * it gives the rail's chevron gutter a chevron and the guide lines a level
 * to draw, so a flat workspace still reads as a tree. Real ids come from
 * `normalizeWorkspacePath`, which strips leading slashes, so a
 * slash-prefixed id cannot collide with any actual workspace path.
 */
export const workspaceRootTreePath = '/workspace';

/** Expansion a fresh tree starts from: the synthetic root open. */
export const initialWorkspaceExpansion: ReadonlySet<string> = new Set([workspaceRootTreePath]);

/** Adds paths to an expansion set, returning the same set when nothing is new. */
export function withWorkspacePaths(current: ReadonlySet<string>, paths: string[]) {
    return paths.every((path) => current.has(path)) ? current : new Set([...current, ...paths]);
}

/** Every folder above `path`, outermost first, excluding `path` itself. */
export function workspaceAncestorPaths(path: string) {
    const segments = normalizeWorkspacePath(path).split('/').filter(Boolean);
    return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'));
}

export function isWorkspaceFileNode(node: WorkspaceTreeNode) {
    return node.kind === 'file';
}

export function normalizeWorkspacePath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}

function pruneWorkspaceNodes(nodes: WorkspaceTreeNode[], query: string): WorkspaceTreeNode[] {
    const matched: WorkspaceTreeNode[] = [];
    for (const node of nodes) {
        if (node.id.toLowerCase().includes(query)) {
            matched.push(node);
            continue;
        }
        if (!node.children) {
            continue;
        }
        const children = pruneWorkspaceNodes(node.children, query);
        if (children.length > 0) {
            matched.push({ ...node, children });
        }
    }
    return matched;
}

function sortWorkspaceNodes(nodes: WorkspaceTreeNode[]) {
    nodes.sort(compareWorkspaceNodes);
    for (const node of nodes) {
        if (node.children) {
            sortWorkspaceNodes(node.children);
        }
    }
}

function compareWorkspaceNodes(left: WorkspaceTreeNode, right: WorkspaceTreeNode) {
    if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}
