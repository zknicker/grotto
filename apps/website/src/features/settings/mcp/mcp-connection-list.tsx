import { Avatar, Chip } from '@heroui/react';
import { DataGrid, type DataGridColumn } from '@heroui-pro/react';
import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import { type ConnectionIcon, connectionIcon } from './connection-icon.ts';
import type { McpConnection } from './mcp-server-shared.ts';

export function ConnectionGrid({
    connections,
    onSelect,
}: {
    connections: McpConnection[];
    onSelect: (connectionId: string) => void;
}) {
    const theme = useResolvedThemeOptional();

    return (
        <DataGrid
            aria-label="MCP connections"
            columns={connectionColumns(theme)}
            data={connections}
            getRowId={(item) => item.id}
            onRowAction={(key) => onSelect(String(key))}
        />
    );
}

function ConnectionAvatar({ icon }: { icon: ConnectionIcon }) {
    return (
        <Avatar className="shrink-0" size="sm">
            {icon.kind === 'image' ? <Avatar.Image alt="" src={icon.src} /> : null}
            <Avatar.Fallback
                style={icon.kind === 'monogram' ? { color: `var(${icon.colorVar})` } : undefined}
            >
                {icon.kind === 'monogram' ? icon.letter : ''}
            </Avatar.Fallback>
        </Avatar>
    );
}

const connectionColumns = (theme: 'dark' | 'light'): DataGridColumn<McpConnection>[] => [
    {
        allowsSorting: true,
        cell: (item) => (
            <div className="flex min-w-0 items-center gap-3">
                <ConnectionAvatar icon={connectionIcon(item, theme)} />
                <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{item.name}</p>
                    <p className="truncate text-muted text-sm">
                        {item.accountLabel ?? (item.builtIn ? 'Built in' : 'Custom')}
                    </p>
                </div>
            </div>
        ),
        header: 'Connection',
        headerClassName: 'text-sm',
        id: 'name',
        isRowHeader: true,
        minWidth: 200,
        sortFn: (a, b) => a.name.localeCompare(b.name),
    },
    {
        cellClassName: 'text-sm text-muted',
        cell: () => 'Remote',
        header: 'Type',
        headerClassName: 'text-sm',
        id: 'type',
        minWidth: 90,
    },
    {
        align: 'end',
        cell: (item) => (
            <Chip color={item.connected ? 'success' : 'default'} size="sm" variant="soft">
                {item.connected ? 'Connected' : 'Not connected'}
            </Chip>
        ),
        header: 'Status',
        headerClassName: 'text-sm',
        id: 'status',
        minWidth: 120,
    },
];
