import { Button, ScrollShadow } from '@heroui/react';
import * as React from 'react';
import {
    type ChannelIconEntry,
    filterChannelIcons,
    useChannelIconCatalog,
} from '../../components/chats/channel-icon-catalog.ts';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';

// The popover keeps the grid short enough to sit under a form field; the
// Icon & color dialog gives the catalog more room. Column count is tuned per
// container width so the buttons pack densely (an emoji-picker feel) rather
// than leaving voids between cells.
const channelIconGridVariants = {
    compact: { columns: 'grid-cols-8', height: 'h-72' },
    tall: { columns: 'grid-cols-9', height: 'h-80' },
} as const;

export type ChannelIconGridSize = keyof typeof channelIconGridVariants;

/** The catalog grid: grouped while browsing, flat while searching. */
export function ChannelIconGrid({
    onSelect,
    query,
    selectedIcon,
    size = 'compact',
}: {
    onSelect: (icon: string) => void;
    query: string;
    selectedIcon: string | null;
    size?: ChannelIconGridSize;
}) {
    const catalog = useChannelIconCatalog();
    const trimmedQuery = query.trim();
    const results = React.useMemo(
        () => (catalog ? filterChannelIcons(catalog.entries, trimmedQuery) : []),
        [catalog, trimmedQuery]
    );
    const selectedButtonRef = React.useRef<HTMLButtonElement | null>(null);
    // Scrolls the selected icon into view once, as soon as the catalog that
    // holds it loads. Later selection changes (the user clicking a new icon)
    // must not re-trigger this.
    const hasScrolledToSelectionRef = React.useRef(false);

    React.useEffect(() => {
        if (hasScrolledToSelectionRef.current || !(catalog && selectedIcon)) {
            return;
        }
        if (!catalog.byName.has(selectedIcon)) {
            return;
        }

        hasScrolledToSelectionRef.current = true;
        selectedButtonRef.current?.scrollIntoView({ block: 'center' });
    }, [catalog, selectedIcon]);

    const variant = channelIconGridVariants[size];

    // The catalog is one chunk away, so the grid holds its height and stays
    // blank rather than flashing a placeholder at it.
    if (!catalog) {
        return <div className={cn(variant.height, 'mt-3 min-h-0')} />;
    }

    return (
        <ScrollShadow className={cn(variant.height, 'mt-3 min-h-0 overflow-y-auto')}>
            {trimmedQuery ? (
                <ChannelIconRow
                    columns={variant.columns}
                    entries={results}
                    onSelect={onSelect}
                    selectedButtonRef={selectedButtonRef}
                    selectedIcon={selectedIcon}
                />
            ) : (
                catalog.groups.map((group) => {
                    const entries = results.filter((entry) => entry.group === group);

                    return entries.length === 0 ? null : (
                        <section key={group}>
                            <h4 className="px-1 pt-2 pb-1 font-medium text-muted text-xs">
                                {group}
                            </h4>
                            <ChannelIconRow
                                columns={variant.columns}
                                entries={entries}
                                onSelect={onSelect}
                                selectedButtonRef={selectedButtonRef}
                                selectedIcon={selectedIcon}
                            />
                        </section>
                    );
                })
            )}
            {results.length === 0 ? (
                <p className="p-2 text-muted text-sm">No icons match.</p>
            ) : null}
        </ScrollShadow>
    );
}

function ChannelIconRow({
    columns,
    entries,
    onSelect,
    selectedButtonRef,
    selectedIcon,
}: {
    columns: string;
    entries: readonly ChannelIconEntry[];
    onSelect: (icon: string) => void;
    selectedButtonRef: React.RefObject<HTMLButtonElement | null>;
    selectedIcon: string | null;
}) {
    return (
        <div className={cn('grid justify-items-center gap-0.5', columns)}>
            {entries.map((entry) => {
                const isSelected = entry.name === selectedIcon;

                return (
                    <ChannelIconButton
                        entry={entry}
                        isSelected={isSelected}
                        key={entry.name}
                        onSelect={onSelect}
                        ref={isSelected ? selectedButtonRef : undefined}
                    />
                );
            })}
        </div>
    );
}

// The catalog renders around a thousand buttons, so each one re-renders only
// when its own selected state changes.
const ChannelIconButton = React.memo(function ChannelIconButton({
    entry,
    isSelected,
    onSelect,
    ref,
}: {
    entry: ChannelIconEntry;
    isSelected: boolean;
    onSelect: (icon: string) => void;
    ref?: React.Ref<HTMLButtonElement>;
}) {
    return (
        <Button
            aria-label={entry.label}
            aria-pressed={isSelected}
            isIconOnly
            onPress={() => onSelect(entry.name)}
            ref={ref}
            size="md"
            variant={isSelected ? 'secondary' : 'ghost'}
        >
            <Icon
                icon={entry.glyph}
                size={24}
                // Inline size so the icon-only button's svg rules cannot
                // shrink the glyph back down.
                style={{ height: 24, width: 24 }}
            />
        </Button>
    );
});
