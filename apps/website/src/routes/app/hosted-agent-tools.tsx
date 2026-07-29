import type { HostedAgent, HostedMcpConnection } from '@tavern/api';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { EmptyState } from '../../components/ui/empty-state.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { SettingsGroup, SettingsRow, SettingsSection } from '../../components/ui/settings-row.tsx';
import { Switch } from '../../components/ui/switch.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

export function HostedAgentTools({
    agent,
    connections,
    serverId,
}: {
    agent: HostedAgent;
    connections: HostedMcpConnection[];
    serverId: string;
}) {
    const utils = grottoTrpc.useUtils();
    const setGrant = grottoTrpc.mcp.setGrant.useMutation({
        onSuccess: () => utils.mcp.list.invalidate({ serverId }),
    });
    const available = connections.filter(
        (connection) => connection.connected && connection.tools.length > 0
    );

    return (
        <SettingsSection title={`Agent MCP access (${available.length})`}>
            <p className="px-3 text-meta text-muted-foreground">
                Choose which Server-managed MCP connections this Agent can use.
            </p>
            <SettingsGroup>
                {available.length === 0 ? (
                    <EmptyState
                        className="py-10 md:py-12"
                        description="Connect an MCP server in Settings → Connections."
                        title="No connections available"
                    />
                ) : (
                    available.map((connection, index) => {
                        const checked = connection.grants.some(
                            (grant) => grant.agentId === agent.id
                        );
                        return (
                            <React.Fragment key={connection.id}>
                                {index > 0 ? <Separator /> : null}
                                <SettingsRow
                                    description={`${connection.tools.length} tools · ${connection.url}`}
                                    title={
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className="truncate">{connection.name}</span>
                                            <Badge variant="subtle">MCP</Badge>
                                        </span>
                                    }
                                >
                                    <div className="flex justify-start md:justify-end">
                                        <Switch
                                            aria-label={`Enable ${connection.name} for ${agent.displayName}`}
                                            checked={checked}
                                            disabled={setGrant.isPending}
                                            onCheckedChange={(enabled) =>
                                                setGrant.mutate({
                                                    agentId: agent.id,
                                                    connectionId: connection.id,
                                                    enabled,
                                                    serverId,
                                                })
                                            }
                                        />
                                    </div>
                                </SettingsRow>
                            </React.Fragment>
                        );
                    })
                )}
            </SettingsGroup>
        </SettingsSection>
    );
}
