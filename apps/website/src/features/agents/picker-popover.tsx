import { Add01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Button } from '../../components/ui/button.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Popover, PopoverPopup, PopoverTrigger } from '../../components/ui/popover.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';

export interface PickerPopoverItem {
    id: string;
    name: string;
}

/**
 * "Add provider"-style dropdown: a small trigger button opening a searchable
 * list of plain names. Picking an item adds it and closes the popover.
 */
export function PickerPopover<Item extends PickerPopoverItem>({
    emptyText,
    isPending,
    items,
    label,
    onAdd,
    searchPlaceholder,
    triggerVariant = 'outline',
}: {
    emptyText: string;
    isPending: boolean;
    items: Item[];
    label: string;
    onAdd: (item: Item) => void;
    searchPlaceholder: string;
    triggerVariant?: 'ghost' | 'outline';
}) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');

    React.useEffect(() => {
        if (open) {
            setQuery('');
        }
    }, [open]);

    const normalizedQuery = query.trim().toLowerCase();
    const visibleItems = normalizedQuery
        ? items.filter((item) => item.name.toLowerCase().includes(normalizedQuery))
        : items;

    return (
        <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger render={<Button size="sm" type="button" variant={triggerVariant} />}>
                <Icon data-icon="inline-start" icon={Add01Icon} />
                {label}
            </PopoverTrigger>
            <PopoverPopup
                align="end"
                className="w-[min(19rem,calc(100vw-2rem))] overflow-hidden py-0 [--viewport-inline-padding:--spacing(0)] [&_[data-slot=popover-viewport]]:p-0"
                sideOffset={8}
            >
                <div className="max-h-[min(20rem,calc(100dvh-8rem))] overflow-y-auto rounded-[inherit]">
                    {items.length === 0 ? (
                        <p className="px-3 py-4 text-muted-foreground text-sm">{emptyText}</p>
                    ) : (
                        <>
                            <div className="sticky top-0 z-10 border-border-subtle border-b bg-popover">
                                <SearchInput
                                    aria-label={searchPlaceholder}
                                    className="[&_[data-slot=input-control]]:h-10 [&_[data-slot=input-control]]:rounded-none [&_[data-slot=input-control]]:border-0 [&_[data-slot=input-control]]:bg-transparent [&_[data-slot=input-control]]:shadow-none [&_[data-slot=input-control]]:has-focus-visible:ring-0"
                                    name="picker-search"
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder={searchPlaceholder}
                                    value={query}
                                />
                            </div>
                            {visibleItems.length > 0 ? (
                                <ul className="divide-y divide-border-subtle">
                                    {visibleItems.map((item) => (
                                        <li key={item.id}>
                                            <button
                                                aria-label={`Add ${item.name}`}
                                                className="flex min-h-10 w-full cursor-pointer items-center px-3 py-2 text-left outline-none hover:bg-hover focus-visible:bg-hover disabled:cursor-default disabled:opacity-64"
                                                disabled={isPending}
                                                onClick={() => {
                                                    setOpen(false);
                                                    onAdd(item);
                                                }}
                                                type="button"
                                            >
                                                <span className="truncate font-medium text-foreground text-sm">
                                                    {item.name}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="px-3 py-4 text-muted-foreground text-sm">
                                    No matches.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </PopoverPopup>
        </Popover>
    );
}
