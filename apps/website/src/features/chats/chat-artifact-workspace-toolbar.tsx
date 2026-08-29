import { Button, Dropdown, Label, SearchField, type Selection } from '@heroui/react';
import { FilterHorizontalIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';

/**
 * Search plus one filter menu, nothing else. Refresh chrome is gone on
 * purpose: workspace queries are invalidated by computer-scope server events
 * and refetch when a mount finds them stale, so a manual refresh button was
 * a second copy of what React Query already does.
 */
export function WorkspaceToolbar({
    includeHidden,
    onIncludeHiddenChange,
    onQueryChange,
    query,
}: {
    includeHidden: boolean;
    onIncludeHiddenChange: (value: boolean) => void;
    onQueryChange: (value: string) => void;
    query: string;
}) {
    return (
        // Padding, not a rule: the rail is one pane of its host's surface, and
        // an internal border under the search field drew a second edge inside
        // a box that already has one.
        <div className="flex shrink-0 flex-row items-center gap-1 p-2">
            <SearchField
                aria-label="Search files"
                className="min-w-0 flex-1"
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
            <Dropdown>
                <Button
                    aria-label="Filter files"
                    className="shrink-0"
                    isIconOnly
                    variant="secondary"
                >
                    <Icon icon={FilterHorizontalIcon} />
                </Button>
                <Dropdown.Popover>
                    <Dropdown.Menu
                        onSelectionChange={(keys: Selection) =>
                            onIncludeHiddenChange(keys === 'all' || keys.has('hidden'))
                        }
                        selectedKeys={includeHidden ? new Set(['hidden']) : new Set()}
                        selectionMode="multiple"
                    >
                        <Dropdown.Item id="hidden" textValue="Hidden files">
                            <Dropdown.ItemIndicator />
                            <Label>Hidden files</Label>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>
        </div>
    );
}
