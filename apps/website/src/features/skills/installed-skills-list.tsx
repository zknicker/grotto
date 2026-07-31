import { Chip, SearchField } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { CubeIcon, Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import type { SkillListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
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
    const searching = search.trim().length > 0;

    return (
        <div className="grid gap-2">
            <SearchField
                aria-label="Search installed Skills"
                fullWidth
                name="skill-search"
                onChange={setSearch}
                value={search}
            >
                <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={searchPlaceholder} />
                    <SearchField.ClearButton />
                </SearchField.Group>
            </SearchField>

            {visibleSkills.length > 0 ? (
                <div className="mt-2 grid">
                    {visibleSkills.map((skill) => (
                        <SkillRow key={skill.id} onSelect={() => onSelect(skill)} skill={skill} />
                    ))}
                </div>
            ) : (
                <EmptyState>
                    <EmptyState.Header>
                        <EmptyState.Title>
                            {searching ? 'No Matches' : (emptyTitle ?? 'No Skills Installed')}
                        </EmptyState.Title>
                        <EmptyState.Description>
                            {searching
                                ? 'Try a different name or description.'
                                : (emptyDescription ?? 'Install Skills from the Available tab.')}
                        </EmptyState.Description>
                    </EmptyState.Header>
                </EmptyState>
            )}
        </div>
    );
}

function SkillRow({ onSelect, skill }: { onSelect: () => void; skill: SkillSummary }) {
    const needsSetup = skill.enabled && skill.dependencyState === 'missing';

    return (
        <button
            className="flex w-full select-none items-center gap-4 rounded-xl px-3 py-2.5 text-left hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={onSelect}
            type="button"
        >
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg border border-separator bg-surface-secondary text-muted',
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
                        <Chip color="danger" size="sm" variant="soft">
                            {skill.diagnostic ?? 'Needs setup'}
                        </Chip>
                    ) : null}
                </span>
                <span className="mt-0.5 line-clamp-1 text-muted text-sm">
                    {skill.description ?? skill.id}
                </span>
            </span>
            {skill.enabled ? (
                <Icon className="size-4 shrink-0 text-muted" icon={Tick02Icon} />
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
