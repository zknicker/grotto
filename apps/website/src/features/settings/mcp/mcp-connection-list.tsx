import { Chip, Tabs } from '@heroui/react';
import type { McpConnection, McpConnectionFilter } from './mcp-server-shared.ts';

export function ConnectionFilters({
    filter,
    onChange,
}: {
    filter: McpConnectionFilter;
    onChange: (filter: McpConnectionFilter) => void;
}) {
    return (
        <Tabs
            onSelectionChange={(value) => onChange(String(value) as McpConnectionFilter)}
            selectedKey={filter}
            variant="secondary"
        >
            <Tabs.ListContainer>
                <Tabs.List aria-label="Filter connections by status">
                    <Tabs.Tab id="all">
                        All
                        <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="connected">
                        Connected
                        <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="not-connected">
                        Not Connected
                        <Tabs.Indicator />
                    </Tabs.Tab>
                </Tabs.List>
            </Tabs.ListContainer>
        </Tabs>
    );
}

export function ConnectionRow({
    connection,
    onSelect,
}: {
    connection: McpConnection;
    onSelect: () => void;
}) {
    return (
        <button
            className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_7rem_8rem] items-center border-separator border-b px-5 text-left outline-none last:border-b-0 hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
            onClick={onSelect}
            type="button"
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-secondary font-semibold text-foreground text-sm">
                    {connection.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground text-sm">
                        {connection.name}
                    </span>
                    <span className="block truncate text-muted text-xs">
                        {connection.accountLabel ?? (connection.builtIn ? 'Built in' : 'Custom')}
                    </span>
                </span>
            </span>
            <span className="text-muted text-sm">Remote</span>
            <Chip color={connection.connected ? 'success' : 'default'} size="sm" variant="soft">
                {connection.connected ? 'Connected' : 'Not connected'}
            </Chip>
        </button>
    );
}
