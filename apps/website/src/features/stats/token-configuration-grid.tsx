import { Chip } from '@heroui/react';
import { DataGrid, type DataGridColumn, ItemCardGroup } from '@heroui-pro/react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import type { ConfigurationUsage } from './token-usage-view.ts';
import { formatPercent, formatTokens } from './usage-format.ts';

export function TokenConfigurationGrid({ rows }: { rows: ConfigurationUsage[] }) {
    const total = rows.reduce((sum, row) => sum + row.totalTokens, 0);
    const columns: DataGridColumn<ConfigurationUsage>[] = [
        {
            cell: (item) => (
                <div className="flex items-center gap-3">
                    <EntityAvatar
                        className="shrink-0"
                        name={item.agentName}
                        size="sm"
                        src={item.agentAvatarUrl}
                    />
                    <div className="min-w-0">
                        <p className="truncate font-medium text-base">{item.agentName}</p>
                        <p className="truncate text-muted text-sm">@{item.agentHandle}</p>
                    </div>
                </div>
            ),
            header: 'Agent',
            headerClassName: 'text-sm',
            id: 'agentName',
            isRowHeader: true,
            minWidth: 160,
            sortFn: (a, b) => a.agentName.localeCompare(b.agentName),
            allowsSorting: true,
        },
        {
            cell: (item) => (
                <Chip size="sm" variant="soft">
                    <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <Chip.Label>{item.runtimeLabel}</Chip.Label>
                </Chip>
            ),
            header: 'Runtime',
            headerClassName: 'text-sm',
            id: 'runtimeLabel',
            minWidth: 110,
            sortFn: (a, b) => a.runtimeLabel.localeCompare(b.runtimeLabel),
            allowsSorting: true,
        },
        {
            accessorKey: 'modelId',
            allowsSorting: true,
            cellClassName: 'font-mono text-base',
            header: 'Model',
            headerClassName: 'text-sm',
            id: 'modelId',
            minWidth: 160,
        },
        numericColumn('inputTokens', 'Input'),
        numericColumn('outputTokens', 'Output'),
        numericColumn('cacheReadTokens', 'Cache read'),
        {
            align: 'end',
            allowsSorting: true,
            cell: (item) => (
                <div className="flex flex-col items-end">
                    <p className="font-semibold text-base tabular-nums">
                        {formatTokens(item.totalTokens)}
                    </p>
                    <p className="text-muted text-sm tabular-nums">
                        {formatPercent(total > 0 ? (item.totalTokens / total) * 100 : 0)}
                    </p>
                </div>
            ),
            header: 'Processed',
            headerClassName: 'text-sm',
            id: 'totalTokens',
            minWidth: 105,
            sortFn: (a, b) => a.totalTokens - b.totalTokens,
        },
    ];

    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>Agent Configurations</ItemCardGroup.Title>
            </ItemCardGroup.Header>
            <DataGrid
                aria-label="Token usage by agent, runtime, and model"
                columns={columns}
                contentClassName="min-w-[800px]"
                data={rows}
                defaultSortDescriptor={{ column: 'totalTokens', direction: 'descending' }}
                getRowId={(item) => item.id}
                renderEmptyState={() => 'No configurations reported usage in this range.'}
            />
        </ItemCardGroup>
    );
}

function numericColumn(
    id: 'cacheReadTokens' | 'inputTokens' | 'outputTokens',
    header: string
): DataGridColumn<ConfigurationUsage> {
    return {
        align: 'end',
        allowsSorting: true,
        cell: (item) => (
            <p className="text-base text-muted tabular-nums">{formatTokens(item[id])}</p>
        ),
        header,
        headerClassName: 'text-sm',
        id,
        minWidth: 85,
        sortFn: (a, b) => a[id] - b[id],
    };
}
