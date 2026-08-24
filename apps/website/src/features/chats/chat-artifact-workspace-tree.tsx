import { FileTree as TreesFileTree, useFileTree } from '@pierre/trees/react';
import * as React from 'react';
import {
    addFolderAncestors,
    compareFileTreeEntries,
    folderAncestors,
    fromTreeFolderPath,
    isTreeFolderPath,
    toTreeFilePath,
    type WorkspaceFileEntry,
} from './chat-artifact-workspace-model.ts';

type TreeHostStyle = React.CSSProperties & Record<`--${string}`, string>;

export function WorkspaceFileTree({
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
            if (entry?.kind === 'file' && entry.path !== current.selectedPath) {
                current.onSelectFile(entry.path);
            }
        },
        paths: treePaths,
        sort: compareFileTreeEntries,
        unsafeCSS: treeUnsafeCss,
    });

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
            <div className="px-3 py-8 text-center text-muted text-sm">
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
  --grotto-tree-row-bg: var(--trees-bg);
  border-radius: 8px;
}

button[data-type='item']:hover {
  --grotto-tree-row-bg: var(--trees-bg-muted);
}

button[data-type='item'][aria-selected='true'] {
  --grotto-tree-row-bg: var(--trees-selected-bg);
  /* Hairline outline, matching the nav rows' selected treatment. */
  box-shadow: inset 0 0 0 1px var(--border);
}

button[data-type='item'][aria-selected='true'] [data-item-section='spacing-item'] {
  border-left-color: transparent;
}

button[data-type='item'][data-item-focused='true']:not(:focus-visible)::before {
  outline: none;
}

[data-file-tree-virtualized-scroll='true'] {
  overflow-x: hidden;
}
`;

const treeHostStyle: TreeHostStyle = {
    '--trees-bg-override': 'var(--surface)',
    '--trees-bg-muted-override': 'var(--surface-secondary)',
    '--trees-border-color-override': 'var(--separator)',
    '--trees-border-radius-override': '8px',
    '--trees-fg-muted-override': 'var(--muted)',
    '--trees-fg-override': 'var(--foreground)',
    '--trees-file-icon-color': 'var(--muted)',
    '--trees-focus-ring-color-override': 'var(--focus)',
    '--trees-selected-focused-border-color-override': 'var(--focus)',
    '--trees-font-family-override': 'inherit',
    '--trees-font-size-override': 'var(--text-sm)',
    '--trees-item-margin-x-override': '0px',
    '--trees-item-padding-x-override': '8px',
    '--trees-level-gap-override': '8px',
    '--trees-padding-inline-override': '4px',
    '--trees-scrollbar-gutter-override': '6px',
    '--trees-selected-bg-override': 'var(--surface-secondary)',
    '--trees-selected-fg-override': 'var(--foreground)',
};
