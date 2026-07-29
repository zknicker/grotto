import type { FileTreeSortEntry } from '@pierre/trees';
import { FileTree as TreesFileTree, useFileTree } from '@pierre/trees/react';
import * as React from 'react';
import type { SkillTreeSubject } from './skill-tree-model.ts';

type TreeHostStyle = React.CSSProperties & Record<`--${string}`, string>;

export function SkillsFileTree({
    onSelect,
    paths,
    query,
    selectedPath,
    subjectsByPath,
}: {
    onSelect: (subject: SkillTreeSubject) => void;
    paths: string[];
    query: string;
    selectedPath: null | string;
    subjectsByPath: Map<string, SkillTreeSubject>;
}) {
    const skillFolderPaths = React.useMemo(
        () => getSkillFolderPaths(subjectsByPath),
        [subjectsByPath]
    );

    return (
        <SkillsFileTreeInner
            key={skillFolderPaths.join('\n')}
            onSelect={onSelect}
            paths={paths}
            query={query}
            selectedPath={selectedPath}
            skillFolderPaths={skillFolderPaths}
            subjectsByPath={subjectsByPath}
        />
    );
}

function SkillsFileTreeInner({
    onSelect,
    paths,
    query,
    selectedPath,
    skillFolderPaths,
    subjectsByPath,
}: {
    onSelect: (subject: SkillTreeSubject) => void;
    paths: string[];
    query: string;
    selectedPath: null | string;
    skillFolderPaths: string[];
    subjectsByPath: Map<string, SkillTreeSubject>;
}) {
    const callbacksRef = useLatestRef({
        onSelect,
        subjectsByPath,
    });
    const unsafeCSS = React.useMemo(() => buildTreeUnsafeCss(skillFolderPaths), [skillFolderPaths]);
    const { model } = useFileTree({
        density: 'compact',
        fileTreeSearchMode: 'hide-non-matches',
        flattenEmptyDirectories: false,
        initialExpansion: 'open',
        initialSearchQuery: query.trim() || null,
        initialSelectedPaths: selectedPath ? [selectedPath] : [],
        itemHeight: 28,
        onSelectionChange(selectedPaths) {
            const path = selectedPaths.find((candidate) =>
                callbacksRef.current.subjectsByPath.has(candidate)
            );
            if (!path) {
                return;
            }
            callbacksRef.current.onSelect(callbacksRef.current.subjectsByPath.get(path)!);
        },
        paths,
        sort: compareFileTreeEntries,
        unsafeCSS,
    });

    React.useEffect(() => {
        model.resetPaths(paths);
        syncTreeSelection(model, selectedPath);
    }, [model, selectedPath, paths]);

    React.useEffect(() => {
        model.setSearch(query.trim() || null);
    }, [model, query]);

    if (paths.length === 0) {
        return <div className="px-3 py-8 text-center text-muted-foreground text-sm">No skills</div>;
    }

    return (
        <TreesFileTree
            className="h-full min-h-0 w-full flex-1 overflow-hidden py-1"
            model={model}
            style={treeHostStyle}
        />
    );
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

    for (const currentPath of model.getSelectedPaths()) {
        if (currentPath !== selectedPath) {
            model.getItem(currentPath)?.deselect();
        }
    }
    const item = model.getItem(selectedPath);
    if (item) {
        item.select();
        model.scrollToPath(selectedPath, { focus: false, offset: 'nearest' });
    }
}

function useLatestRef<T>(value: T) {
    const ref = React.useRef(value);
    ref.current = value;
    return ref;
}

function getSkillFolderPaths(subjectsByPath: Map<string, SkillTreeSubject>) {
    return [...subjectsByPath.keys()]
        .map((path) => path.replace(/SKILL\.md$/u, ''))
        .sort((left, right) => left.localeCompare(right));
}

function buildTreeUnsafeCss(skillFolderPaths: string[]) {
    const skillIconSelectors = skillFolderPaths
        .map(
            (path) =>
                `button[data-type='item'][data-item-path="${cssAttributeValue(path)}"] > [data-item-section='content']::before`
        )
        .join(',\n');

    return `${treeUnsafeCss}

${skillIconSelectors ? `${skillIconSelectors} {\n  --tavern-skill-tree-folder-icon: var(--tavern-skill-tree-cube-icon);\n}\n` : ''}`;
}

function cssAttributeValue(value: string) {
    return value.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"');
}

const folderIconMask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M8 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7' stroke='black' stroke-linecap='round' stroke-width='1.8'/%3E%3C/svg%3E")`;

const cubeIconMask = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M2.79289 21.2071C3.08579 21.5 3.55719 21.5 4.5 21.5H14.5C15.4428 21.5 15.9142 21.5 16.2071 21.2071M2.79289 21.2071C2.5 20.9142 2.5 20.4428 2.5 19.5V9.5C2.5 8.55719 2.5 8.08579 2.79289 7.79289M2.79289 21.2071L8.79289 15.2071M16.2071 21.2071C16.5 20.9142 16.5 20.4428 16.5 19.5V9.5C16.5 8.55719 16.5 8.08579 16.2071 7.79289M16.2071 21.2071L21.2071 16.2071C21.5 15.9142 21.5 15.4428 21.5 14.5V4.5C21.5 3.55719 21.5 3.08579 21.2071 2.79289M16.2071 7.79289C15.9142 7.5 15.4428 7.5 14.5 7.5H4.5C3.55719 7.5 3.08579 7.5 2.79289 7.79289M16.2071 7.79289L21.2071 2.79289M2.79289 7.79289L7.79289 2.79289C8.08579 2.5 8.55719 2.5 9.5 2.5H19.5C20.4428 2.5 20.9142 2.5 21.2071 2.79289M8.79289 15.2071C9.08579 15.5 9.55719 15.5 10.5 15.5H14M8.79289 15.2071C8.5 14.9142 8.5 14.4428 8.5 13.5V10.5' stroke='black' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.8'/%3E%3C/svg%3E")`;

const treeUnsafeCss = `
button[data-type='item'][data-item-type='folder'] {
  --tavern-skill-tree-folder-icon: var(--tavern-skill-tree-folder-icon-default);
}

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

button[data-type='item'][data-item-type='folder'] > [data-item-section='icon'] {
  order: 3;
  margin-left: auto;
  color: var(--trees-fg-muted);
}

button[data-type='item'][data-item-type='folder'] > [data-item-section='content'] {
  order: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

button[data-type='item'][data-item-type='folder'] > [data-item-section='content']::before {
  content: '';
  display: inline-block;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  background-color: var(--trees-fg-muted);
  mask: var(--tavern-skill-tree-folder-icon) center / contain no-repeat;
  -webkit-mask: var(--tavern-skill-tree-folder-icon) center / contain no-repeat;
}

button[data-type='item'][data-item-type='folder'] > [data-item-section='content'] > * {
  min-width: 0;
}
`;

const treeHostStyle: TreeHostStyle = {
    '--tavern-skill-tree-cube-icon': cubeIconMask,
    '--tavern-skill-tree-folder-icon-default': folderIconMask,
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
    '--trees-indent-guide-bg-override': 'transparent',
    '--trees-item-margin-x-override': '0px',
    '--trees-item-padding-x-override': '8px',
    '--trees-level-gap-override': '8px',
    '--trees-padding-inline-override': '4px',
    '--trees-scrollbar-gutter-override': '6px',
    '--trees-selected-bg-override': 'var(--secondary)',
    '--trees-selected-fg-override': 'var(--foreground)',
};
