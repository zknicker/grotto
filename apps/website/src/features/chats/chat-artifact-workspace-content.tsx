import * as React from 'react';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';
import { cn } from '../../lib/utils.ts';
import {
    buildWorkspaceTree,
    filterWorkspaceTree,
    initialWorkspaceExpansion,
    normalizeWorkspacePath,
    type WorkspaceDirectoryEntries,
    withWorkspacePaths,
    workspaceAncestorPaths,
    workspaceRootTreePath,
} from './chat-artifact-workspace-model.ts';
import {
    WorkspaceArtifactContent,
    WorkspaceArtifactEmpty,
} from './chat-artifact-workspace-preview.tsx';
import { WorkspaceToolbar } from './chat-artifact-workspace-toolbar.tsx';
import { WorkspaceFileTree } from './chat-artifact-workspace-tree.tsx';

/**
 * HeroUI Sidebar's own default width. The `sidebar` rail variant matches it
 * exactly so a file rail and the app sidebar read as the same kind of chrome.
 * (Sidebar scopes `--sidebar-width: 240px` to itself, so the value is
 * restated here rather than read from a var another component owns.)
 */
const sidebarRailWidth = 240;

export function WorkspaceBrowserContent({
    agentId,
    initialDirectoryPath = '',
    railVariant = 'panel',
    sidebarStorageKey = 'grotto.artifactPane.workspaceSidebar.width',
    selectedPath: controlledSelectedPath,
    onSelectPath,
    serverId,
    treeSide = 'end',
}: {
    agentId: string;
    initialDirectoryPath?: string;
    /** `sidebar` renders the rail as page chrome: the primary sidebar's own
        ground and fixed width, no drag handle. The chat panel's default
        `panel` stays flush with the panel's ground and resizable. */
    railVariant?: 'panel' | 'sidebar';
    sidebarStorageKey?: string;
    /** Controlled open file — when provided, the host owns it (e.g. via the URL) so it
        survives the tab moving to another window. Omitted callers keep local state. */
    selectedPath?: null | string;
    onSelectPath?: (path: null | string) => void;
    serverId: string;
    /** Which edge the file rail sits on. The Artifact Panel keeps it trailing,
        beside the chat it belongs to; a page reads it as navigation and leads. */
    treeSide?: 'end' | 'start';
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
    const [includeHidden, setIncludeHidden] = React.useState(false);
    const [expandedPaths, setExpandedPaths] =
        React.useState<ReadonlySet<string>>(initialWorkspaceExpansion);
    const [loadedEntriesByDirectory, setLoadedEntriesByDirectory] =
        React.useState<WorkspaceDirectoryEntries>({});
    const [directoryLoadError, setDirectoryLoadError] = React.useState<string | null>(null);
    const initialDirectory = normalizeWorkspacePath(initialDirectoryPath);
    const serverUtils = grottoTrpc.useUtils();
    const fileSidebarWidth = useResizablePaneWidth({
        defaultWidth: 300,
        maxWidth: 440,
        minWidth: 220,
        storageKey: sidebarStorageKey,
    });
    const filesQuery = grottoTrpc.agent.workspaceFiles.useQuery(
        { agentId, includeHidden, path: '', serverId },
        { ...queryPolicy.computerSnapshot, enabled: agentId.length > 0 }
    );
    const entriesByDirectory = React.useMemo(
        () => ({
            ...loadedEntriesByDirectory,
            '': filesQuery.data?.entries ?? [],
        }),
        [filesQuery.data?.entries, loadedEntriesByDirectory]
    );
    const visibleNodes = React.useMemo(
        () => filterWorkspaceTree(buildWorkspaceTree(entriesByDirectory), query),
        [entriesByDirectory, query]
    );

    const setSelectedPathRef = React.useRef(setSelectedPath);
    setSelectedPathRef.current = setSelectedPath;
    const previousAgentRef = React.useRef(agentId);
    const previousRootRefreshRef = React.useRef(filesQuery.dataUpdatedAt);
    React.useEffect(() => {
        setLoadedEntriesByDirectory({});
        setExpandedPaths(initialWorkspaceExpansion);
        setDirectoryLoadError(agentId ? null : 'No active agent workspace is available.');

        // Clear the open file only when the agent actually changes, not on mount — a
        // URL-driven (controlled) selection must survive the initial render.
        if (previousAgentRef.current !== agentId) {
            previousAgentRef.current = agentId;
            setSelectedPathRef.current(null);
        }
    }, [agentId]);

    React.useEffect(() => {
        if (previousRootRefreshRef.current === filesQuery.dataUpdatedAt) {
            return;
        }
        previousRootRefreshRef.current = filesQuery.dataUpdatedAt;
        setLoadedEntriesByDirectory({});
        setExpandedPaths(initialWorkspaceExpansion);
        setDirectoryLoadError(null);
    }, [filesQuery.dataUpdatedAt]);

    const loadDirectory = React.useCallback(
        async (nextPath: string) => {
            setDirectoryLoadError(null);
            if (loadedEntriesByDirectory[nextPath]) {
                return;
            }

            try {
                const result = await serverUtils.agent.workspaceFiles.fetch({
                    agentId,
                    includeHidden,
                    path: nextPath,
                    serverId,
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
            serverUtils.agent.workspaceFiles,
            includeHidden,
            loadedEntriesByDirectory,
            serverId,
        ]
    );

    React.useEffect(() => {
        if (filesQuery.data && initialDirectory) {
            setExpandedPaths((current) => withWorkspacePaths(current, [initialDirectory]));
            void loadDirectory(initialDirectory);
        }
    }, [filesQuery.data, initialDirectory, loadDirectory]);

    // A host-driven selection (the URL, a linked artifact) has to reveal itself.
    React.useEffect(() => {
        if (selectedPath) {
            setExpandedPaths((current) =>
                withWorkspacePaths(current, workspaceAncestorPaths(selectedPath))
            );
        }
    }, [selectedPath]);

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
    const treeAtStart = treeSide === 'start';

    const preview = (
        <section className="h-full min-h-0 min-w-0 overflow-hidden">
            {selectedTarget ? (
                <WorkspaceArtifactContent
                    agentId={agentId}
                    includeHidden={includeHidden}
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
        </section>
    );

    const isSidebarRail = railVariant === 'sidebar';
    const railWidth = isSidebarRail ? sidebarRailWidth : fileSidebarWidth.width;
    const fileRail = (
        // No box of its own: the rail is one pane of the host's surface, and a
        // separator is the whole boundary between it and the preview. The
        // sidebar variant wears the primary sidebar's ground and fixed width;
        // the panel variant stays flush and resizable.
        <aside
            className={cn(
                'relative flex h-full min-h-0 flex-col overflow-x-hidden border-separator',
                treeAtStart ? 'border-e' : 'border-s',
                isSidebarRail ? 'sub-sidebar' : null
            )}
        >
            {isSidebarRail ? null : (
                <ResizablePaneRail
                    maxWidth={440}
                    minWidth={220}
                    onWidthChange={fileSidebarWidth.setWidth}
                    onWidthCommit={fileSidebarWidth.persistWidth}
                    side={treeAtStart ? 'right' : 'left'}
                    width={fileSidebarWidth.width}
                />
            )}
            <WorkspaceToolbar
                includeHidden={includeHidden}
                onIncludeHiddenChange={(value) => {
                    setIncludeHidden(value);
                    setLoadedEntriesByDirectory({});
                    setExpandedPaths(initialWorkspaceExpansion);
                    setDirectoryLoadError(null);
                }}
                onQueryChange={setQuery}
                query={query}
            />
            <div className="flex min-h-0 flex-1 overflow-hidden px-1 pb-2">
                <WorkspaceFileTree
                    expandedPaths={expandedPaths}
                    hasQuery={query.trim().length > 0}
                    nodes={visibleNodes}
                    onExpandedChange={(paths) => {
                        for (const path of paths) {
                            // The synthetic root is not a real directory —
                            // nothing to fetch when it toggles.
                            if (path !== workspaceRootTreePath && !expandedPaths.has(path)) {
                                void loadDirectory(path);
                            }
                        }
                        setExpandedPaths(paths);
                    }}
                    onSelectDirectory={(path) => {
                        setExpandedPaths((current) => withWorkspacePaths(current, [path]));
                        void loadDirectory(path);
                    }}
                    onSelectFile={setSelectedPath}
                    selectedPath={selectedPath}
                />
            </div>
        </aside>
    );

    return (
        <div
            className="grid h-full min-h-0 overflow-hidden bg-background"
            style={{
                gridTemplateColumns: treeAtStart
                    ? `${railWidth}px minmax(0, 1fr)`
                    : `minmax(0, 1fr) ${railWidth}px`,
            }}
        >
            {treeAtStart ? fileRail : preview}
            {treeAtStart ? preview : fileRail}
        </div>
    );
}
