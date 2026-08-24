import { Button, Tooltip } from '@heroui/react';
import { ItemCardGroup } from '@heroui-pro/react';
import { PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useConnections } from '../../../hooks/servers/use-connections.ts';
import { toConnectionView } from './connection-view.tsx';
import { ConnectionGrid } from './mcp-connection-list.tsx';

export function ConnectionListSection({
    onAdd,
    onSelect,
    serverId,
}: {
    onAdd: () => void;
    onSelect: (connectionId: string) => void;
    serverId: string;
}) {
    const connections = useConnections(serverId);
    const agents = useAgents(serverId);
    const items = (connections.data ?? []).map((connection) =>
        toConnectionView(connection, agents.data ?? [])
    );

    return (
        <ItemCardGroup variant="transparent">
            {/* Adding a connection adds a row to this table, so the control
                belongs to the section rather than the page. */}
            <ItemCardGroup.Header className="flex items-center justify-between gap-3">
                <ItemCardGroup.Title>
                    Added
                    {connections.data ? (
                        <span className="ms-2 text-muted tabular-nums">{items.length}</span>
                    ) : null}
                </ItemCardGroup.Title>
                <Tooltip delay={0}>
                    <Button
                        aria-label="Add MCP Server"
                        isIconOnly
                        onPress={onAdd}
                        size="sm"
                        variant="secondary"
                    >
                        <Icon aria-hidden="true" icon={PlusSignIcon} size={16} />
                    </Button>
                    <Tooltip.Content>Add MCP Server</Tooltip.Content>
                </Tooltip>
            </ItemCardGroup.Header>
            {connections.isPending && !connections.data ? (
                <div aria-busy="true" className="min-h-32">
                    <span className="sr-only">Loading MCP connections</span>
                </div>
            ) : connections.error && !connections.data ? (
                <p className="py-8 text-center text-danger text-sm" role="alert">
                    {connections.error.message}
                </p>
            ) : items.length > 0 ? (
                <ConnectionGrid connections={items} onSelect={onSelect} />
            ) : (
                <p className="py-8 text-center text-muted text-sm">No connections.</p>
            )}
        </ItemCardGroup>
    );
}
