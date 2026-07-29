import { FileEmpty02Icon } from '@hugeicons/core-free-icons';
import type { HostedImportableSkill } from '@tavern/api';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
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
            <aside className="relative flex h-full min-h-0 w-full shrink-0 flex-col overflow-x-hidden border-border/70 border-r bg-background text-sidebar-foreground">
                <ResizablePaneRail
                    maxWidth={380}
                    minWidth={240}
                    onWidthChange={sidebarWidth.setWidth}
                    onWidthCommit={sidebarWidth.persistWidth}
                    side="right"
                    width={sidebarWidth.width}
                />
                <SidebarHeader className="gap-0 border-border/70 border-b px-3 pt-4 pb-3">
                    <h2 className="h-6 truncate font-semibold text-base text-foreground">Skills</h2>
                    <p className="mt-2 text-muted-foreground text-sm">
                        Skills available on your Computers.
                    </p>
                </SidebarHeader>
                <div className="flex h-10 shrink-0 items-center border-border/70 border-b px-3 font-medium text-muted-foreground text-sm">
                    Browse skills
                </div>
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
            </aside>
            <section className="flex min-h-0 min-w-0 flex-col">
                <HostedSkillPreview source={selected} />
            </section>
        </div>
    );
}

function HostedSkillPreview({ source }: { source: HostedSkillSource | null }) {
    if (!source) {
        return (
            <div className="grid h-full min-h-[28rem] place-items-center">
                <div className="grid justify-items-center gap-3 px-8 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground">
                        <Icon className="size-6" icon={FileEmpty02Icon} />
                    </span>
                    <p className="font-medium text-foreground text-sm">No preview</p>
                    <p className="max-w-sm text-muted-foreground text-sm">
                        Connect a Computer with installed skills.
                    </p>
                </div>
            </div>
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
            <div className="mt-5 rounded-xl border border-border/70 bg-card px-9 py-7">
                <p className="font-medium text-foreground">Add skills from an Agent profile</p>
                <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
                    Open an Agent, then use the plus button in Skills to copy this skill into that
                    Agent’s library.
                </p>
            </div>
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
