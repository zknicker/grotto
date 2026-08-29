import type { ChannelIconEntry } from '../../components/chats/channel-icon-catalog.ts';

/**
 * Row model for the channel icon catalog.
 *
 * The catalog is ~1,600 glyphs, so the grid virtualizes and renders one screen
 * of rows at a time. That makes the row — a group header, or a full run of icon
 * cells — the unit the virtualizer counts and measures, and this module is
 * where the catalog is folded into that shape.
 */

export type ChannelIconRow =
    | {
          readonly entries: readonly ChannelIconEntry[];
          readonly key: string;
          readonly kind: 'icons';
      }
    | { readonly group: string; readonly key: string; readonly kind: 'header' };

/**
 * Grouped while browsing, one flat run while searching — matching what the
 * grid showed before it was virtualized.
 */
export function buildChannelIconRows({
    columns,
    entries,
    groups,
    isGrouped,
}: {
    columns: number;
    entries: readonly ChannelIconEntry[];
    groups: readonly string[];
    isGrouped: boolean;
}): readonly ChannelIconRow[] {
    if (!isGrouped) {
        return chunk(entries, columns).map((run, index) => ({
            entries: run,
            key: `results-${index}`,
            kind: 'icons',
        }));
    }

    // One bucketing pass. Filtering per group instead walks the whole catalog
    // once per group, which is most of what a keystroke used to cost.
    const byGroup = new Map<string, ChannelIconEntry[]>();
    for (const entry of entries) {
        const bucket = byGroup.get(entry.group);
        if (bucket) {
            bucket.push(entry);
        } else {
            byGroup.set(entry.group, [entry]);
        }
    }

    const rows: ChannelIconRow[] = [];
    for (const group of groups) {
        const inGroup = byGroup.get(group);
        if (!inGroup?.length) {
            continue;
        }

        rows.push({ group, key: `header-${group}`, kind: 'header' });
        for (const [index, run] of chunk(inGroup, columns).entries()) {
            rows.push({ entries: run, key: `${group}-${index}`, kind: 'icons' });
        }
    }

    return rows;
}

/** The row index a given icon lands on, or -1 when it is not in `rows`. */
export function channelIconRowIndex(rows: readonly ChannelIconRow[], name: string): number {
    return rows.findIndex(
        (row) => row.kind === 'icons' && row.entries.some((entry) => entry.name === name)
    );
}

function chunk<T>(items: readonly T[], size: number): (readonly T[])[] {
    const runs: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        runs.push(items.slice(index, index + size));
    }

    return runs;
}
