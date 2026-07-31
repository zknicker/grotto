import { Chip, Separator, Switch } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import type { HostedAgent, HostedMcpConnection } from '@tavern/api';
import * as React from 'react';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../features/settings/layout/settings-page.tsx';
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
        <SettingsSection
            action={
                <Chip size="sm" variant="soft">
                    {available.length}
                </Chip>
            }
            title="Agent MCP Access"
        >
            <p className="px-1 text-muted text-sm">
                Choose which Server-managed MCP connections this Agent can use.
            </p>
            <SettingsGroup>
                {available.length === 0 ? (
                    <EmptyState size="sm">
                        <EmptyState.Header>
                            <EmptyState.Title>No connections available</EmptyState.Title>
                            <EmptyState.Description>
                                Connect an MCP server in Settings → Connections.
                            </EmptyState.Description>
                        </EmptyState.Header>
                    </EmptyState>
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
                                            <Chip size="sm" variant="soft">
                                                MCP
                                            </Chip>
                                        </span>
                                    }
                                    trailingWidth="intrinsic"
                                >
                                    <Switch
                                        aria-label={`Enable ${connection.name} for ${agent.displayName}`}
                                        isDisabled={setGrant.isPending}
                                        isSelected={checked}
                                        onChange={(enabled) =>
                                            setGrant.mutate({
                                                agentId: agent.id,
                                                connectionId: connection.id,
                                                enabled,
                                                serverId,
                                            })
                                        }
                                    >
                                        <Switch.Content>
                                            <Switch.Control>
                                                <Switch.Thumb />
                                            </Switch.Control>
                                        </Switch.Content>
                                    </Switch>
                                </SettingsRow>
                            </React.Fragment>
                        );
                    })
                )}
            </SettingsGroup>
        </SettingsSection>
    );
}
