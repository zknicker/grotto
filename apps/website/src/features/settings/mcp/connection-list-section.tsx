import * as React from 'react';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useConnections } from '../../../hooks/servers/use-connections.ts';
import { SettingsGroup, SettingsSection } from '../layout/settings-page.tsx';
import { toConnectionView } from './connection-view.tsx';
import { ConnectionFilters, ConnectionRow } from './mcp-connection-list.tsx';
import type { McpConnectionFilter } from './mcp-server-shared.ts';
import { visibleConnections } from './mcp-server-shared.ts';

export function ConnectionListSection({
    onSelect,
    serverId,
}: {
    onSelect: (connectionId: string) => void;
    serverId: string;
}) {
    const [filter, setFilter] = React.useState<McpConnectionFilter>('all');
    const connections = useConnections(serverId);
    const agents = useAgents(serverId);
    const items = (connections.data ?? []).map((connection) =>
        toConnectionView(connection, agents.data ?? [])
    );

    return (
        <SettingsSection title="MCP Connections">
            <div className="px-1">
                <ConnectionFilters filter={filter} onChange={setFilter} />
            </div>
            <SettingsGroup>
                <div className="grid grid-cols-[minmax(0,1fr)_7rem_8rem] border-separator border-b bg-surface-secondary px-5 py-2 text-muted text-xs">
                    <span>Connection</span>
                    <span>Type</span>
                    <span>Status</span>
                </div>
                {visibleConnections(items, filter).map((connection) => (
                    <ConnectionRow
                        connection={connection}
                        key={connection.id}
                        onSelect={() => onSelect(connection.id)}
                    />
                ))}
                {!connections.isPending && items.length === 0 ? (
                    <p className="px-5 py-8 text-center text-muted text-sm">No connections.</p>
                ) : null}
            </SettingsGroup>
        </SettingsSection>
    );
}
