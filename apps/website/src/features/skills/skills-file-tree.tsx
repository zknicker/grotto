import type { Selection } from '@heroui/react';
import { FileTree } from '@heroui-pro/react';
import {
    CubeIcon,
    FileEmpty02Icon,
    Folder01Icon,
    FolderOpenIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Collection } from 'react-aria-components';
import { Icon } from '../../components/ui/icon.tsx';
import type { SkillTreeSubject } from './skill-tree-model.ts';

/**
 * One row of the Skills browser. `id` is the flat tree path the browser already
 * speaks — folders keep their trailing slash so a skill folder and its
 * `SKILL.md` never collide, and file ids match `subjectsByPath` exactly.
 */
interface SkillNode {
    children?: SkillNode[];
    id: string;
    kind: 'file' | 'folder';
    name: string;
}

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
    const nodes = React.useMemo(() => buildSkillNodes(paths), [paths]);
    const visibleNodes = React.useMemo(() => filterSkillNodes(nodes, query), [nodes, query]);
    const folderPaths = React.useMemo(() => collectFolderPaths(visibleNodes), [visibleNodes]);
    // Skills read as a flat list of open folders, so expansion is tracked by
    // what the reader closed. A skill that arrives later is open on arrival
    // instead of hiding its SKILL.md behind a chevron nobody knew to press.
    const [collapsedPaths, setCollapsedPaths] = React.useState<ReadonlySet<string>>(
        () => new Set()
    );
    const expandedKeys = React.useMemo(
        () => new Set(folderPaths.filter((path) => !collapsedPaths.has(path))),
        [collapsedPaths, folderPaths]
    );
    const selectedKeys = React.useMemo<Selection>(
        () => new Set(selectedPath ? [selectedPath] : []),
        [selectedPath]
    );
    const skillFolderPaths = React.useMemo(
        () => new Set([...subjectsByPath.keys()].map((path) => path.replace(/SKILL\.md$/u, ''))),
        [subjectsByPath]
    );

    return (
        <FileTree
            aria-label="Skills"
            className="h-full min-h-0 w-full flex-1"
            expandedKeys={expandedKeys}
            items={visibleNodes}
            onExpandedChange={(keys) => {
                const expanded = new Set([...keys].map(String));
                setCollapsedPaths(new Set(folderPaths.filter((path) => !expanded.has(path))));
            }}
            onSelectionChange={(keys) => {
                if (keys === 'all') {
                    return;
                }
                const path = [...keys].map(String).at(0);
                const subject = path ? subjectsByPath.get(path) : undefined;
                if (subject) {
                    onSelect(subject);
                }
            }}
            renderEmptyState={() => 'No Skills'}
            selectedKeys={selectedKeys}
            // `replace`, not the default `toggle`: toggle selection puts a
            // checkbox on every row, and this rail opens one skill at a time.
            selectionBehavior="replace"
            selectionMode="single"
        >
            {function renderSkillNode(node: SkillNode) {
                const isFolder = node.kind === 'folder';
                return (
                    <FileTree.Item
                        icon={isFolder ? folderIcon(skillFolderPaths.has(node.id)) : skillFileIcon}
                        id={node.id}
                        textValue={node.name}
                        title={node.name}
                    >
                        {node.children && node.children.length > 0 ? (
                            <Collection items={node.children}>{renderSkillNode}</Collection>
                        ) : null}
                    </FileTree.Item>
                );
            }}
        </FileTree>
    );
}

function buildSkillNodes(paths: string[]): SkillNode[] {
    const roots: SkillNode[] = [];
    const nodesById = new Map<string, SkillNode>();

    const ensureFolder = (id: string): SkillNode | null => {
        if (!id) {
            return null;
        }
        const existing = nodesById.get(id);
        if (existing) {
            return existing;
        }
        const segments = id.slice(0, -1).split('/');
        const parent = ensureFolder(
            segments.length > 1 ? `${segments.slice(0, -1).join('/')}/` : ''
        );
        const node: SkillNode = { children: [], id, kind: 'folder', name: segments.at(-1) ?? id };
        nodesById.set(id, node);
        (parent?.children ?? roots).push(node);
        return node;
    };

    for (const path of paths) {
        if (path.endsWith('/')) {
            ensureFolder(path);
            continue;
        }
        if (nodesById.has(path)) {
            continue;
        }
        const segments = path.split('/');
        const parent = ensureFolder(
            segments.length > 1 ? `${segments.slice(0, -1).join('/')}/` : ''
        );
        const node: SkillNode = { id: path, kind: 'file', name: segments.at(-1) ?? path };
        nodesById.set(path, node);
        (parent?.children ?? roots).push(node);
    }

    sortSkillNodes(roots);
    return roots;
}

function filterSkillNodes(nodes: SkillNode[], query: string): SkillNode[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return nodes;
    }
    const matched: SkillNode[] = [];
    for (const node of nodes) {
        if (node.id.toLowerCase().includes(normalizedQuery)) {
            matched.push(node);
            continue;
        }
        const children = node.children ? filterSkillNodes(node.children, query) : [];
        if (children.length > 0) {
            matched.push({ ...node, children });
        }
    }
    return matched;
}

function collectFolderPaths(nodes: SkillNode[]): string[] {
    return nodes.flatMap((node) =>
        node.kind === 'folder' ? [node.id, ...collectFolderPaths(node.children ?? [])] : []
    );
}

function sortSkillNodes(nodes: SkillNode[]) {
    nodes.sort((left, right) => {
        if (left.kind !== right.kind) {
            return left.kind === 'folder' ? -1 : 1;
        }
        return left.name.localeCompare(right.name, undefined, {
            numeric: true,
            sensitivity: 'base',
        });
    });
    for (const node of nodes) {
        if (node.children) {
            sortSkillNodes(node.children);
        }
    }
}

/** A skill's own folder carries the skill mark; grouping folders stay folders. */
function folderIcon(isSkill: boolean) {
    if (isSkill) {
        return skillIcon;
    }
    return ({ isExpanded }: { isExpanded: boolean }) => (
        <Icon icon={isExpanded ? FolderOpenIcon : Folder01Icon} />
    );
}

const skillIcon = <Icon icon={CubeIcon} />;
const skillFileIcon = <Icon icon={FileEmpty02Icon} />;
