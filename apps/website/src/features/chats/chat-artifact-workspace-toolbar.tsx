import { Button, SearchField } from '@heroui/react';
import { EyeIcon, EyeOff, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';

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
        <div className="flex h-12 flex-row items-center gap-1 border-separator border-b py-2 pr-2 pl-2">
            <SearchField
                aria-label="Search files"
                fullWidth
                onChange={onQueryChange}
                value={query}
                variant="secondary"
            >
                <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Search files" />
                    <SearchField.ClearButton />
                </SearchField.Group>
            </SearchField>
            <Button
                aria-label={includeHidden ? 'Hide hidden files' : 'Show hidden files'}
                aria-pressed={includeHidden}
                isIconOnly
                onPress={() => onIncludeHiddenChange(!includeHidden)}
                size="sm"
                variant={includeHidden ? 'secondary' : 'ghost'}
            >
                <Icon icon={includeHidden ? EyeIcon : EyeOff} />
            </Button>
            <Button
                aria-label="Refresh workspace"
                isDisabled={refreshing}
                isIconOnly
                onPress={onRefresh}
                size="sm"
                variant="ghost"
            >
                <Icon icon={RefreshIcon} />
            </Button>
        </div>
    );
}
