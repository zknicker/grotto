import { CubeIcon, Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { FluidList, FluidListItem } from '../../components/ui/fluid-list.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { EmptyState } from '../shell/empty-state.tsx';
import { formatSkillName } from './skill-name-format.ts';

type SkillSummary = SkillListOutput['skills'][number];

export function InstalledSkillsList({
    emptyDescription,
    emptyTitle,
    onSelect,
    searchPlaceholder = 'Search skills...',
    skills,
}: {
    emptyDescription?: string;
    emptyTitle?: string;
    onSelect: (skill: SkillSummary) => void;
    searchPlaceholder?: string;
    skills: SkillSummary[];
}) {
    const [search, setSearch] = React.useState('');
    const deferredSearch = React.useDeferredValue(search);
    const visibleSkills = filterSkills(skills, deferredSearch);

    return (
        <div className="grid gap-2">
            <SearchInput
                aria-label="Search installed skills"
                className="w-full"
                name="skill-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                size="xl"
                value={search}
            />

            {visibleSkills.length > 0 ? (
                <FluidList className="mt-2 grid">
                    {visibleSkills.map((skill, index) => (
                        <FluidListItem className="-mx-3" index={index} key={skill.id}>
                            <SkillRow onSelect={() => onSelect(skill)} skill={skill} />
                        </FluidListItem>
                    ))}
                </FluidList>
            ) : (
                <EmptyState
                    className="py-16"
                    description={
                        search.trim().length > 0
                            ? 'Try a different name or description.'
                            : (emptyDescription ?? 'Install skills from the Available tab.')
                    }
                    title={
                        search.trim().length > 0
                            ? 'No matches'
                            : (emptyTitle ?? 'No skills installed')
                    }
                />
            )}
        </div>
    );
}

function SkillRow({ onSelect, skill }: { onSelect: () => void; skill: SkillSummary }) {
    const needsSetup = skill.enabled && skill.dependencyState === 'missing';

    return (
        <button
            className="flex w-full select-none items-center gap-4 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onSelect}
            type="button"
        >
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-muted text-muted-foreground',
                    !skill.enabled && 'opacity-45'
                )}
            >
                <Icon className="size-5" icon={CubeIcon} />
            </span>
            <span className={cn('min-w-0 flex-1', !skill.enabled && 'opacity-45')}>
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-foreground text-sm">
                        {formatSkillName(skill.name)}
                    </span>
                    {needsSetup ? (
                        <Badge size="sm" variant="error">
                            {skill.diagnostic ?? 'Needs setup'}
                        </Badge>
                    ) : null}
                </span>
                <span className="mt-0.5 line-clamp-1 text-muted-foreground text-sm">
                    {skill.description ?? skill.id}
                </span>
            </span>
            {skill.enabled ? (
                <Icon className="size-4 shrink-0 text-muted-foreground" icon={Tick02Icon} />
            ) : null}
        </button>
    );
}

function filterSkills(skills: SkillSummary[], search: string) {
    const normalized = search.trim().toLowerCase();
    if (normalized.length === 0) {
        return skills;
    }
    return skills.filter((skill) =>
        [skill.name, skill.description, skill.id, skill.diagnostic].some((value) =>
            (value ?? '').toLowerCase().includes(normalized)
        )
    );
}
