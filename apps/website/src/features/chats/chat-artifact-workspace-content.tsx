import * as React from 'react';
import {
    ResizablePaneRail,
    useResizablePaneWidth,
} from '../../components/ui/resizable-pane-rail.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';
import {
    buildWorkspaceTreePaths,
    filterWorkspaceTreePaths,
    normalizeWorkspacePath,
    toTreeEntryPath,
    type WorkspaceDirectoryEntries,
} from './chat-artifact-workspace-model.ts';
import {
    WorkspaceArtifactContent,
    WorkspaceArtifactEmpty,
} from './chat-artifact-workspace-preview.tsx';
import { WorkspaceToolbar } from './chat-artifact-workspace-toolbar.tsx';
import { WorkspaceFileTree } from './chat-artifact-workspace-tree.tsx';

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
    const [includeHidden, setIncludeHidden] = React.useState(false);
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
        { agentId, includeHidden, path: '' },
        { ...queryPolicy.agentRuntimeSnapshot, enabled: agentId.length > 0 && !serverId }
    );
    const hostedFilesQuery = grottoTrpc.agent.workspaceFiles.useQuery(
        { agentId, includeHidden, path: '', serverId: serverId ?? '' },
        { ...queryPolicy.agentRuntimeSnapshot, enabled: agentId.length > 0 && Boolean(serverId) }
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

    const selectionControlsRef = useLatestRef({ setSelectedPath });
    const previousAgentRef = React.useRef(agentId);
    const previousRootRefreshRef = React.useRef(filesQuery.dataUpdatedAt);
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

    React.useEffect(() => {
        if (previousRootRefreshRef.current === filesQuery.dataUpdatedAt) {
            return;
        }
        previousRootRefreshRef.current = filesQuery.dataUpdatedAt;
        setLoadedEntriesByDirectory({});
        setDirectoryLoadError(null);
    }, [filesQuery.dataUpdatedAt]);

    const loadDirectory = React.useCallback(
        async (nextPath: string) => {
            setDirectoryLoadError(null);
            if (loadedEntriesByDirectory[nextPath]) {
                return;
            }

            try {
                const result = serverId
                    ? await hostedUtils.agent.workspaceFiles.fetch({
                          agentId,
                          includeHidden,
                          path: nextPath,
                          serverId,
                      })
                    : await utils.agent.workspaceFiles.fetch({
                          agentId,
                          includeHidden,
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
            includeHidden,
            loadedEntriesByDirectory,
            serverId,
            utils.agent.workspaceFiles,
        ]
    );

    const refreshWorkspace = React.useCallback(async () => {
        setLoadedEntriesByDirectory({});
        setDirectoryLoadError(null);

        if (serverId) {
            await Promise.all([
                hostedUtils.agent.workspaceFiles.invalidate({
                    agentId,
                    includeHidden,
                    path: '',
                    serverId,
                }),
                selectedPath
                    ? hostedUtils.agent.workspaceFile.invalidate({
                          agentId,
                          includeHidden,
                          path: selectedPath,
                          serverId,
                      })
                    : Promise.resolve(),
            ]);
            return;
        }

        await Promise.all([
            utils.agent.workspaceFiles.invalidate({ agentId, includeHidden, path: '' }),
            selectedPath
                ? utils.agent.workspaceReadableFile.invalidate({
                      agentId,
                      includeHidden,
                      path: selectedPath,
                  })
                : Promise.resolve(),
        ]);
    }, [agentId, hostedUtils, includeHidden, selectedPath, serverId, utils]);

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
                </div>
            </section>
            <aside className="relative flex min-h-0 flex-col overflow-x-hidden border-separator border-l bg-surface text-foreground">
                <ResizablePaneRail
                    maxWidth={440}
                    minWidth={220}
                    onWidthChange={fileSidebarWidth.setWidth}
                    onWidthCommit={fileSidebarWidth.persistWidth}
                    side="left"
                    width={fileSidebarWidth.width}
                />
                <WorkspaceToolbar
                    includeHidden={includeHidden}
                    onIncludeHiddenChange={(value) => {
                        setIncludeHidden(value);
                        setLoadedEntriesByDirectory({});
                        setDirectoryLoadError(null);
                    }}
                    onQueryChange={setQuery}
                    onRefresh={() => void refreshWorkspace()}
                    query={query}
                    refreshing={filesQuery.isFetching}
                />
                <div className="flex min-h-0 flex-1 overflow-x-hidden px-1 py-2">
                    <WorkspaceFileTree
                        entriesByTreePath={entriesByTreePath}
                        hasQuery={query.trim().length > 0}
                        onSelectDirectory={(nextPath) => {
                            setSelectedPath(null);
                            void loadDirectory(nextPath);
                        }}
                        onSelectFile={setSelectedPath}
                        selectedPath={selectedPath}
                        treePaths={visibleTreePaths}
                    />
                </div>
            </aside>
        </div>
    );
}

function useLatestRef<T>(value: T) {
    const ref = React.useRef(value);
    ref.current = value;
    return ref;
}
