import { FileEmpty02Icon } from '@hugeicons/core-free-icons';
import type { HostedImportableSkill } from '@tavern/api';
import * as React from 'react';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../components/ui/empty.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { PaneTopbar, SidePane } from '../../components/ui/pane.tsx';
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
import { Elevated } from '../../components/ui/surface.tsx';
import { formatSkillName } from './skill-name-format.ts';
import { buildSkillTreePaths, type SkillTreeSubject } from './skill-tree-model.ts';
import { SkillsFileTree } from './skills-file-tree.tsx';

export interface HostedSkillSource {
    computerId: string;
    skill: HostedImportableSkill;
}

export function HostedSkillsBrowser({ sources }: { sources: HostedSkillSource[] }) {
    const [selectedPath, setSelectedPath] = React.useState<null | string>(null);
    const sidebarWidth = useResizablePaneWidth({
        defaultWidth: 300,
        maxWidth: 380,
        minWidth: 240,
        storageKey: 'tavern.skills.sidebar.width',
    });
    const entries = React.useMemo(() => buildTreeEntries(sources), [sources]);
    const subjects = React.useMemo(() => entries.map((entry) => entry.subject), [entries]);
    const paths = React.useMemo(() => buildSkillTreePaths(subjects), [subjects]);
    const subjectsByPath = React.useMemo(
        () => new Map(subjects.map((subject) => [subject.treePath, subject])),
        [subjects]
    );

    React.useEffect(() => {
        if (selectedPath && subjectsByPath.has(selectedPath)) {
            return;
        }
        setSelectedPath(subjects[0]?.treePath ?? null);
    }, [selectedPath, subjects, subjectsByPath]);

    const selected = selectedPath
        ? (entries.find((entry) => entry.subject.treePath === selectedPath)?.source ?? null)
        : null;

    return (
        <div
            className="grid h-full min-h-0 flex-1 overflow-hidden bg-background"
            style={{ gridTemplateColumns: `${sidebarWidth.width}px minmax(0, 1fr)` }}
        >
            <SidePane className="w-full flex-col text-sidebar-foreground" side="left">
                <ResizablePaneRail
                    maxWidth={380}
                    minWidth={240}
                    onWidthChange={sidebarWidth.setWidth}
                    onWidthCommit={sidebarWidth.persistWidth}
                    side="right"
                    width={sidebarWidth.width}
                />
                <SidebarHeader className="gap-0 border-[var(--content-card-border)] border-b px-3 pt-4 pb-3">
                    <h2 className="h-6 truncate font-semibold text-base text-foreground">Skills</h2>
                    <p className="mt-2 text-muted-foreground text-sm">
                        Skills available on your Computers.
                    </p>
                </SidebarHeader>
                <PaneTopbar className="font-medium text-muted-foreground text-sm">
                    Browse skills
                </PaneTopbar>
                <SidebarContent className="min-h-0 flex-1 overflow-x-hidden">
                    <SidebarGroup className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-1 py-0">
                        <SidebarGroupContent className="flex min-h-0 flex-1 overflow-x-hidden">
                            <SkillsFileTree
                                onSelect={(subject) => setSelectedPath(subject.treePath)}
                                paths={paths}
                                query=""
                                selectedPath={selectedPath}
                                subjectsByPath={subjectsByPath}
                            />
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </SidePane>
            <section className="flex min-h-0 min-w-0 flex-col">
                <HostedSkillPreview source={selected} />
            </section>
        </div>
    );
}

function HostedSkillPreview({ source }: { source: HostedSkillSource | null }) {
    if (!source) {
        return (
            <Empty className="min-h-[28rem]">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Icon icon={FileEmpty02Icon} />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">No preview</EmptyTitle>
                    <EmptyDescription className="text-sm">
                        Connect a Computer with installed skills.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="h-full min-h-0 overflow-y-auto bg-background px-5 pt-5 pb-6">
            <header>
                <h2 className="font-semibold text-foreground text-xl leading-tight">
                    {formatSkillName(source.skill.name)}
                </h2>
                <div className="mt-6 grid grid-cols-[max-content_max-content] gap-x-10 gap-y-1">
                    <span className="font-semibold text-muted-foreground text-sm">Source</span>
                    <span className="font-semibold text-muted-foreground text-sm">Computer</span>
                    <span className="text-foreground text-sm leading-5">{source.skill.source}</span>
                    <span className="font-mono text-foreground text-sm leading-5">
                        {source.computerId.slice(-6)}
                    </span>
                </div>
                <div className="mt-4 max-w-[48rem]">
                    <p className="font-semibold text-muted-foreground text-sm">Description</p>
                    <p className="mt-1 text-foreground text-sm leading-5">
                        {source.skill.description || 'No description provided.'}
                    </p>
                </div>
            </header>
            <Elevated className="mt-5 max-w-[48rem] rounded-xl px-5 py-4" offset={1}>
                <p className="font-medium text-foreground text-sm">
                    Add skills from an Agent profile
                </p>
                <p className="mt-1 text-muted-foreground text-sm leading-5">
                    Open an Agent, then use the plus button in Skills to copy this skill into that
                    Agent’s library.
                </p>
            </Elevated>
        </div>
    );
}

function buildTreeEntries(sources: HostedSkillSource[]) {
    const counts = new Map<string, number>();
    for (const source of sources) {
        counts.set(source.skill.name, (counts.get(source.skill.name) ?? 0) + 1);
    }
    return sources.map((source) => ({
        source,
        subject: toTreeSubject(source, counts.get(source.skill.name) !== 1),
    }));
}

function toTreeSubject(source: HostedSkillSource, duplicated: boolean): SkillTreeSubject {
    const sourceId = source.skill.id.replaceAll('/', '／');

    return {
        dependencyState: 'ready',
        description: source.skill.description,
        diagnostic: null,
        edited: false,
        identifier: null,
        installed: true,
        managedSource: null,
        name: source.skill.name,
        readOnly: true,
        skillId: null,
        sourceLabel: source.skill.source,
        treePath: duplicated
            ? `Computer ${source.computerId}/${source.skill.name} · ${sourceId}/SKILL.md`
            : `${source.skill.name}/SKILL.md`,
        uninstallName: null,
        updateAvailable: false,
        updatedAt: null,
    };
}
