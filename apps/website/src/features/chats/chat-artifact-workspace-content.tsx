import type { FileTreeSortEntry } from '@pierre/trees';
import { FileTree as TreesFileTree, useFileTree } from '@pierre/trees/react';
import type { HostedWorkspaceFileEntry } from '@tavern/api';
import * as React from 'react';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
} from '../../components/ui/sidebar.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { trpc } from '../../lib/trpc.tsx';
import {
    WorkspaceArtifactContent,
    WorkspaceArtifactEmpty,
} from './chat-artifact-workspace-preview.tsx';

type TreeHostStyle = React.CSSProperties & Record<`--${string}`, string>;
type WorkspaceFileEntry = HostedWorkspaceFileEntry;
type WorkspaceDirectoryEntries = Record<string, WorkspaceFileEntry[]>;

export function WorkspaceBrowserContent({
    agentId,
    initialDirectoryPath = '',
    sidebarStorageKey = 'tavern.artifactPane.workspaceSidebar.width',
    selectedPath: controlledSelectedPath,
    onSelectPath,
    serverId,
}: {
    agentId: string;
    initialDirectoryPath?: string;
    sidebarStorageKey?: string;
    /** Controlled open file — when provided, the host owns it (e.g. via the URL) so it
        survives the tab moving to another window. Omitted callers keep local state. */
    selectedPath?: null | string;
    onSelectPath?: (path: null | string) => void;
    serverId?: string;
}) {
    const [internalSelectedPath, setInternalSelectedPath] = React.useState<string | null>(null);
    const selectedPath = onSelectPath ? (controlledSelectedPath ?? null) : internalSelectedPath;
    const setSelectedPath = React.useCallback(
        (path: null | string) => {
            if (onSelectPath) {
                onSelectPath(path);
            } else {
                setInternalSelectedPath(path);
            }
        },
        [onSelectPath]
    );
    const [query, setQuery] = React.useState('');
    const [loadedEntriesByDirectory, setLoadedEntriesByDirectory] =
        React.useState<WorkspaceDirectoryEntries>({});
    const [directoryLoadError, setDirectoryLoadError] = React.useState<string | null>(null);
    const initialDirectory = normalizeWorkspacePath(initialDirectoryPath);
    const utils = trpc.useUtils();
    const hostedUtils = grottoTrpc.useUtils();
    const fileSidebarWidth = useResizablePaneWidth({
        defaultWidth: 300,
        maxWidth: 440,
        minWidth: 220,
        storageKey: sidebarStorageKey,
    });
    const localFilesQuery = trpc.agent.workspaceFiles.useQuery(
        { agentId, path: '' },
        { enabled: agentId.length > 0 && !serverId }
    );
    const hostedFilesQuery = grottoTrpc.agent.workspaceFiles.useQuery(
        { agentId, path: '', serverId: serverId ?? '' },
        { enabled: agentId.length > 0 && Boolean(serverId) }
    );
    const filesQuery = serverId ? hostedFilesQuery : localFilesQuery;
    const entriesByDirectory = React.useMemo(
        () => ({
            ...loadedEntriesByDirectory,
            '': filesQuery.data?.entries ?? [],
        }),
        [filesQuery.data?.entries, loadedEntriesByDirectory]
    );
    const treePaths = React.useMemo(
        () => buildWorkspaceTreePaths(entriesByDirectory),
        [entriesByDirectory]
    );
    const visibleTreePaths = React.useMemo(
        () => filterWorkspaceTreePaths(treePaths, query),
        [query, treePaths]
    );
    const entriesByTreePath = React.useMemo(() => {
        return new Map(
            Object.values(entriesByDirectory)
                .flat()
                .map((entry) => [toTreeEntryPath(entry), entry])
        );
    }, [entriesByDirectory]);

    // Keyed on the agent ONLY: an unstable onSelectPath identity must never
    // wipe the loaded folder cache on ordinary re-renders.
    const selectionControlsRef = useLatestRef({ setSelectedPath });
    const previousAgentRef = React.useRef(agentId);
    React.useEffect(() => {
        setLoadedEntriesByDirectory({});
        setDirectoryLoadError(agentId ? null : 'No active agent workspace is available.');

        // Clear the open file only when the agent actually changes, not on mount — a
        // URL-driven (controlled) selection must survive the initial render.
        if (previousAgentRef.current !== agentId) {
            previousAgentRef.current = agentId;
            selectionControlsRef.current.setSelectedPath(null);
        }
    }, [agentId, selectionControlsRef]);

    const loadDirectory = React.useCallback(
        async (nextPath: string) => {
            setSelectedPath(null);
            setDirectoryLoadError(null);
            if (loadedEntriesByDirectory[nextPath]) {
                return;
            }

            try {
                const result = serverId
                    ? await hostedUtils.agent.workspaceFiles.fetch({
                          agentId,
                          path: nextPath,
                          serverId,
                      })
                    : await utils.agent.workspaceFiles.fetch({
                          agentId,
                          path: nextPath,
                      });
                setLoadedEntriesByDirectory((current) => ({
                    ...current,
                    [nextPath]: result.entries,
                }));
            } catch {
                setDirectoryLoadError('Unable to load this workspace folder.');
            }
        },
        [
            agentId,
            hostedUtils.agent.workspaceFiles,
            loadedEntriesByDirectory,
            serverId,
            setSelectedPath,
            utils.agent.workspaceFiles,
        ]
    );

    React.useEffect(() => {
        if (filesQuery.data && initialDirectory) {
            void loadDirectory(initialDirectory);
        }
    }, [filesQuery.data, initialDirectory, loadDirectory]);

    if (!agentId) {
        return (
            <WorkspaceArtifactEmpty
                detail="No active agent workspace is available."
                title="Workspace"
            />
        );
    }

    if (filesQuery.isPending) {
        return <WorkspaceArtifactEmpty detail="Loading workspace files..." title="Workspace" />;
    }

    if (filesQuery.error) {
        return (
            <WorkspaceArtifactEmpty detail="Unable to browse this workspace." title="Workspace" />
        );
    }

    const selectedTarget = selectedPath
        ? ({ kind: 'workspaceFile', path: selectedPath } as const)
        : null;

    // File content left, tree right: the tree is a picker beside the open
    // file, not a navigation rail in front of it.
    return (
        <div
            className="grid h-full min-h-0 overflow-hidden bg-background"
            style={{ gridTemplateColumns: `minmax(0, 1fr) ${fileSidebarWidth.width}px` }}
        >
            <section className="flex min-h-0 min-w-0 flex-col">
                <div className="min-h-0 flex-1 overflow-hidden">
                    {selectedTarget ? (
                        <WorkspaceArtifactContent
                            agentId={agentId}
                            serverId={serverId}
                            target={selectedTarget}
                        />
                    ) : (
                        <WorkspaceArtifactEmpty
                            detail={
                                directoryLoadError ??
                                'Select a Markdown, HTML, image, or text file from the workspace sidebar.'
                            }
                            title="No file selected"
                        />
                    )}
                </div>
            </section>
            <aside className="relative flex min-h-0 flex-col overflow-x-hidden border-border/70 border-l bg-sidebar/35 text-sidebar-foreground">
                <ResizablePaneRail
                    maxWidth={440}
                    minWidth={220}
                    onWidthChange={fileSidebarWidth.setWidth}
                    onWidthCommit={fileSidebarWidth.persistWidth}
                    side="left"
                    width={fileSidebarWidth.width}
                />
                <SidebarHeader className="h-12 border-border/70 border-b py-2 pr-2 pl-2">
                    <SearchInput
                        className="w-full min-w-0"
                        onChange={(event) => setQuery(event.currentTarget.value)}
                        placeholder="Search files"
                        size="sm"
                        value={query}
                    />
                </SidebarHeader>
                <SidebarContent className="min-h-0 flex-1 overflow-x-hidden">
                    <SidebarGroup className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-1 py-2">
                        <SidebarGroupContent className="flex min-h-0 flex-1 overflow-x-hidden">
                            <WorkspaceFileTree
                                entriesByTreePath={entriesByTreePath}
                                hasQuery={query.trim().length > 0}
                                onSelectDirectory={(nextPath) => {
                                    void loadDirectory(nextPath);
                                }}
                                onSelectFile={setSelectedPath}
                                selectedPath={selectedPath}
                                treePaths={visibleTreePaths}
                            />
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </aside>
        </div>
    );
}

function WorkspaceFileTree({
    entriesByTreePath,
    hasQuery,
    onSelectDirectory,
    onSelectFile,
    selectedPath,
    treePaths,
}: {
    entriesByTreePath: Map<string, WorkspaceFileEntry>;
    hasQuery: boolean;
    onSelectDirectory: (path: string) => void;
    onSelectFile: (path: string) => void;
    selectedPath: null | string;
    treePaths: string[];
}) {
    const callbacksRef = useLatestRef({
        entriesByTreePath,
        onSelectDirectory,
        onSelectFile,
        selectedPath,
    });
    const selectedTreePath = selectedPath ? toTreeFilePath(selectedPath) : undefined;
    const { model } = useFileTree({
        density: 'compact',
        flattenEmptyDirectories: false,
        // Folders load lazily, so a folder's chevron must not claim "open"
        // before its children exist; only the open file's chain starts
        // expanded.
        initialExpansion: 'closed',
        initialExpandedPaths: selectedTreePath ? folderAncestors(selectedTreePath) : [],
        initialSelectedPaths: selectedTreePath ? [selectedTreePath] : [],
        itemHeight: 28,
        onSelectionChange(selectedPaths) {
            const nextPath = selectedPaths.at(0);
            if (!nextPath) {
                return;
            }

            const current = callbacksRef.current;
            if (isTreeFolderPath(nextPath)) {
                current.onSelectDirectory(fromTreeFolderPath(nextPath));
                return;
            }

            const entry = current.entriesByTreePath.get(nextPath);
            // The model emits for programmatic syncs too; re-reporting the
            // already-selected file would echo back into the pane record.
            if (entry?.kind === 'file' && entry.path !== current.selectedPath) {
                current.onSelectFile(entry.path);
            }
        },
        paths: treePaths,
        sort: compareFileTreeEntries,
        unsafeCSS: treeUnsafeCss,
    });

    // resetPaths is a whole-tree rebuild, so gate it on path CONTENT
    // (refetches hand us new arrays with identical paths) and carry the
    // current expansion state across — a rebuild must not pop folders open
    // or shut. Searching shows every match, so all folders open while a
    // query is active.
    const appliedTreeSignatureRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        const signature = treePaths.join('\n');
        if (appliedTreeSignatureRef.current !== signature) {
            appliedTreeSignatureRef.current = signature;
            model.resetPaths(treePaths, {
                initialExpandedPaths: hasQuery
                    ? treePaths.filter(isTreeFolderPath)
                    : expandedTreeFolders(model, treePaths, selectedTreePath),
            });
        }
        syncTreeSelection(model, selectedPath);
    }, [hasQuery, model, selectedPath, selectedTreePath, treePaths]);

    if (treePaths.length === 0) {
        return (
            <div className="px-3 py-8 text-center text-muted-foreground text-sm">
                {hasQuery ? 'No matching files' : 'No files'}
            </div>
        );
    }

    return (
        <TreesFileTree
            className="h-full min-h-0 w-full flex-1 overflow-hidden py-2"
            model={model}
            style={treeHostStyle}
        />
    );
}

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

function addFolderAncestors(paths: Set<string>, path: string) {
    const segments = path.split('/').filter(Boolean);
    const folderSegments = isTreeFolderPath(path) ? segments : segments.slice(0, -1);
    for (let index = 0; index < folderSegments.length; index += 1) {
        paths.add(`${segments.slice(0, index + 1).join('/')}/`);
    }
}

function folderAncestors(treePath: string) {
    const ancestors = new Set<string>();
    addFolderAncestors(ancestors, treePath);
    return [...ancestors];
}

// The expansion set a rebuild should keep: whatever the user has open now,
// plus the open file's chain.
function expandedTreeFolders(
    model: ReturnType<typeof useFileTree>['model'],
    treePaths: string[],
    selectedTreePath: string | undefined
) {
    const expanded = new Set<string>();
    for (const path of treePaths) {
        if (!isTreeFolderPath(path)) {
            continue;
        }
        const item = model.getItem(path);
        if (item && 'isExpanded' in item && item.isExpanded()) {
            expanded.add(path);
        }
    }
    if (selectedTreePath) {
        addFolderAncestors(expanded, selectedTreePath);
    }
    return [...expanded];
}

function toTreeEntryPath(entry: WorkspaceFileEntry) {
    return entry.kind === 'directory' ? toTreeFolderPath(entry.path) : toTreeFilePath(entry.path);
}

function toTreeFilePath(path: string) {
    return normalizeWorkspacePath(path);
}

function toTreeFolderPath(path: string) {
    const normalized = normalizeWorkspacePath(path);
    return normalized ? `${normalized}/` : '';
}

function fromTreeFolderPath(path: string) {
    return trimTreeFolderSlash(normalizeWorkspacePath(path));
}

function normalizeWorkspacePath(path: string) {
    return path.trim().replace(/\\/gu, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
}

function trimTreeFolderSlash(path: string) {
    return path.replace(/\/+$/u, '');
}

function isTreeFolderPath(path: string) {
    return path.endsWith('/');
}

function compareFileTreeEntries(left: FileTreeSortEntry, right: FileTreeSortEntry) {
    if (left.isDirectory !== right.isDirectory) {
        return left.isDirectory ? -1 : 1;
    }
    return left.basename.localeCompare(right.basename, undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}

function useLatestRef<T>(value: T) {
    const ref = React.useRef(value);
    ref.current = value;
    return ref;
}

function syncTreeSelection(
    model: ReturnType<typeof useFileTree>['model'],
    selectedPath: null | string
) {
    if (!selectedPath) {
        for (const currentPath of model.getSelectedPaths()) {
            model.getItem(currentPath)?.deselect();
        }
        return;
    }

    const nextSelectedPath = toTreeFilePath(selectedPath);
    for (const currentPath of model.getSelectedPaths()) {
        if (currentPath !== nextSelectedPath) {
            model.getItem(currentPath)?.deselect();
        }
    }
    // Reveal the file: a morph can land on a file inside a collapsed folder.
    for (const ancestorPath of folderAncestors(nextSelectedPath)) {
        const ancestor = model.getItem(ancestorPath);
        if (ancestor && 'expand' in ancestor) {
            ancestor.expand();
        }
    }
    const item = model.getItem(nextSelectedPath);
    if (item) {
        item.select();
        model.scrollToPath(nextSelectedPath, { focus: false, offset: 'nearest' });
    }
}

const treeUnsafeCss = `
button[data-type='item'] {
  --tavern-tree-row-bg: var(--trees-bg);
  border-radius: 8px;
}

button[data-type='item']:hover {
  --tavern-tree-row-bg: var(--trees-bg-muted);
}

button[data-type='item'][aria-selected='true'] {
  --tavern-tree-row-bg: var(--trees-selected-bg);
  /* Inked outline + press slab, matching the nav rows' selected treatment. */
  box-shadow: inset 0 0 0 1px var(--input), 0 2px 0 0 var(--hard-shadow);
}

/* Indent guides stop at the selected chip instead of striking through it. */
button[data-type='item'][aria-selected='true'] [data-item-section='spacing-item'] {
  border-left-color: transparent;
}

/* No lingering ring after pointer selection — the tree marks rows
   data-item-focused on click and keeps it. Real keyboard focus
   (:focus-visible) still draws the ring. */
button[data-type='item'][data-item-focused='true']:not(:focus-visible)::before {
  outline: none;
}

[data-file-tree-virtualized-scroll='true'] {
  overflow-x: hidden;
}
`;

const treeHostStyle: TreeHostStyle = {
    '--trees-bg-override': 'var(--sidebar)',
    '--trees-bg-muted-override': 'var(--sidebar-accent)',
    '--trees-border-color-override': 'var(--sidebar-border)',
    '--trees-border-radius-override': '8px',
    '--trees-fg-muted-override': 'var(--muted-foreground)',
    '--trees-fg-override': 'var(--sidebar-foreground)',
    '--trees-file-icon-color': 'var(--sidebar-foreground)',
    '--trees-focus-ring-color-override': 'var(--sidebar-ring)',
    '--trees-selected-focused-border-color-override': 'var(--sidebar-ring)',
    '--trees-font-family-override': 'inherit',
    '--trees-font-size-override': 'var(--text-sm)',
    '--trees-item-margin-x-override': '0px',
    '--trees-item-padding-x-override': '8px',
    '--trees-level-gap-override': '8px',
    '--trees-padding-inline-override': '4px',
    '--trees-scrollbar-gutter-override': '6px',
    '--trees-selected-bg-override': 'var(--secondary)',
    '--trees-selected-fg-override': 'var(--foreground)',
};
