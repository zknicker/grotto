import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../../components/ui/tabs-subtle.tsx';
import type { McpConnection, McpConnectionFilter } from './mcp-server-shared.ts';

export function ConnectionFilters({
    filter,
    onChange,
}: {
    filter: McpConnectionFilter;
    onChange: (filter: McpConnectionFilter) => void;
}) {
    return (
        <TabsSubtle
            onValueChange={(value) => onChange(value as McpConnectionFilter)}
            value={filter}
        >
            <TabsSubtleList aria-label="Filter connections by status">
                <TabsSubtleItem size="sm" value="all">
                    All
                </TabsSubtleItem>
                <TabsSubtleItem size="sm" value="connected">
                    Connected
                </TabsSubtleItem>
                <TabsSubtleItem size="sm" value="not-connected">
                    Not connected
                </TabsSubtleItem>
            </TabsSubtleList>
        </TabsSubtle>
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
            className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_7rem_8rem] items-center border-border/40 border-b px-5 text-left outline-none transition-colors last:border-b-0 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onClick={onSelect}
            type="button"
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-foreground text-sm">
                    {connection.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground text-sm">
                        {connection.name}
                    </span>
                    <span className="block truncate text-meta text-muted-foreground">
                        {connection.accountLabel ?? (connection.builtIn ? 'Built in' : 'Custom')}
                    </span>
                </span>
            </span>
            <span className="text-muted-foreground text-sm">Remote</span>
            <span className="flex items-center gap-2 text-sm">
                <span
                    className={
                        connection.connected
                            ? 'size-2 rounded-full bg-success'
                            : 'size-2 rounded-full bg-muted-foreground/40'
                    }
                />
                {connection.connected ? 'Connected' : 'Not connected'}
            </span>
        </button>
    );
}
