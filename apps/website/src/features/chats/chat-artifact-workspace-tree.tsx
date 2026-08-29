import type { Selection } from '@heroui/react';
import { FileTree, useFileTree } from '@heroui-pro/react';
import { File01Icon, Folder01Icon, FolderOpenIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Collection } from 'react-aria-components';
import { Icon } from '../../components/ui/icon.tsx';
import {
    isWorkspaceFileNode,
    type WorkspaceTreeNode,
    workspaceRootTreePath,
} from './chat-artifact-workspace-model.ts';

export function WorkspaceFileTree({
    expandedPaths,
    hasQuery,
    nodes,
    onExpandedChange,
    onSelectDirectory,
    onSelectFile,
    selectedPath,
}: {
    expandedPaths: ReadonlySet<string>;
    hasQuery: boolean;
    nodes: WorkspaceTreeNode[];
    onExpandedChange: (paths: Set<string>) => void;
    onSelectDirectory: (path: string) => void;
    onSelectFile: (path: string) => void;
    selectedPath: null | string;
}) {
    // One synthetic "Workspace" root wraps the real entries: the chevron
    // gutter gets a chevron and the guide lines get a level to draw, so even
    // a flat workspace reads as a tree. Empty trees stay unwrapped so the
    // stock empty state still renders.
    const rootedNodes = React.useMemo<WorkspaceTreeNode[]>(
        () =>
            nodes.length === 0
                ? []
                : [
                      {
                          children: nodes,
                          id: workspaceRootTreePath,
                          kind: 'directory',
                          name: 'Workspace',
                      },
                  ],
        [nodes]
    );
    const { expandableKeys, leaves } = useFileTree({
        isLeaf: isWorkspaceFileNode,
        items: rootedNodes,
    });
    const filePaths = React.useMemo(() => new Set(leaves.map((leaf) => leaf.id)), [leaves]);
    // A query opens every branch it left standing, so a match buried three
    // folders down is visible without the reader hunting for it. The
    // synthetic root rides along unconditionally: it starts open and stays
    // open even if a stale expansion set from before it existed lacks it.
    const expandedKeys = React.useMemo(
        () =>
            hasQuery ? new Set(expandableKeys) : new Set([...expandedPaths, workspaceRootTreePath]),
        [expandableKeys, expandedPaths, hasQuery]
    );
    const selectedKeys = React.useMemo<Selection>(
        () => new Set(selectedPath ? [selectedPath] : []),
        [selectedPath]
    );

    return (
        <FileTree
            aria-label="Workspace files"
            className="h-full min-h-0 w-full flex-1"
            expandedKeys={expandedKeys}
            items={rootedNodes}
            onExpandedChange={(keys) => {
                const next = new Set([...keys].map(String));
                // The synthetic root never collapses — it exists to give the
                // tree its top level, not to be managed.
                next.add(workspaceRootTreePath);
                onExpandedChange(next);
            }}
            onSelectionChange={(keys) => {
                if (keys === 'all') {
                    return;
                }
                const path = [...keys].map(String).at(0);
                if (!path) {
                    return;
                }
                // The synthetic root is structure, not a destination.
                if (path === workspaceRootTreePath) {
                    return;
                }
                if (filePaths.has(path)) {
                    if (path !== selectedPath) {
                        onSelectFile(path);
                    }
                    return;
                }
                onSelectDirectory(path);
            }}
            renderEmptyState={() => (hasQuery ? 'No matching files' : 'No files')}
            selectedKeys={selectedKeys}
            // `replace`, not the default `toggle`: toggle selection puts a
            // checkbox on every row, and this rail picks one file to preview.
            selectionBehavior="replace"
            selectionMode="single"
        >
            {renderWorkspaceNode}
        </FileTree>
    );
}

function renderWorkspaceNode(node: WorkspaceTreeNode) {
    const isDirectory = node.kind === 'directory';
    return (
        <FileTree.Item
            // A directory listed but not yet fetched has no children to infer
            // from, and without the chevron there is nothing to expand — which
            // is what triggers the fetch in the first place.
            hasChildItems={isDirectory}
            icon={isDirectory ? directoryIcon : fileIcon}
            id={node.id}
            textValue={node.name}
            title={node.name}
        >
            {node.children && node.children.length > 0 ? (
                <Collection items={node.children}>{renderWorkspaceNode}</Collection>
            ) : null}
        </FileTree.Item>
    );
}

const directoryIcon = ({ isExpanded }: { isExpanded: boolean }) => (
    <Icon icon={isExpanded ? FolderOpenIcon : Folder01Icon} />
);

const fileIcon = <Icon icon={File01Icon} />;
