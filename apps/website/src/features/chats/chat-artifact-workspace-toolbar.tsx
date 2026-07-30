import { EyeIcon, EyeOff, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import { SidebarHeader } from '../../components/ui/sidebar.tsx';

export function WorkspaceToolbar({
    includeHidden,
    onIncludeHiddenChange,
    onQueryChange,
    onRefresh,
    query,
    refreshing,
}: {
    includeHidden: boolean;
    onIncludeHiddenChange: (value: boolean) => void;
    onQueryChange: (value: string) => void;
    onRefresh: () => void;
    query: string;
    refreshing: boolean;
}) {
    return (
        <SidebarHeader className="flex h-12 flex-row items-center gap-1 border-border-subtle border-b py-2 pr-2 pl-2">
            <SearchInput
                className="w-full min-w-0"
                onChange={(event) => onQueryChange(event.currentTarget.value)}
                placeholder="Search files"
                size="sm"
                value={query}
            />
            <Button
                aria-label={includeHidden ? 'Hide hidden files' : 'Show hidden files'}
                aria-pressed={includeHidden}
                onClick={() => onIncludeHiddenChange(!includeHidden)}
                size="icon-sm"
                variant={includeHidden ? 'secondary' : 'ghost'}
            >
                <Icon icon={includeHidden ? EyeIcon : EyeOff} />
            </Button>
            <Button
                aria-label="Refresh workspace"
                disabled={refreshing}
                onClick={onRefresh}
                size="icon-sm"
                variant="ghost"
            >
                <Icon icon={RefreshIcon} />
            </Button>
        </SidebarHeader>
    );
}
