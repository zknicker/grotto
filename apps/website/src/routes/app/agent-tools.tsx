import { Chip, Separator, Switch } from '@heroui/react';
import { EmptyState, ItemCard, ItemCardGroup } from '@heroui-pro/react';
import type { Agent, McpConnection } from '@tavern/api';
import * as React from 'react';
import { SettingsSection } from '../../features/settings/layout/settings-page.tsx';
import { useAgentGrant } from '../../hooks/members/use-agent-grant.ts';

export function AgentTools({
    agent,
    connections,
    serverId,
}: {
    agent: Agent;
    connections: McpConnection[];
    serverId: string;
}) {
    const grant = useAgentGrant(serverId, agent.id);
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
            <ItemCardGroup className="overflow-hidden">
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
                                <ItemCard>
                                    <ItemCard.Content>
                                        <ItemCard.Title>
                                            <span className="flex min-w-0 items-center gap-2">
                                                <span className="truncate">{connection.name}</span>
                                                <Chip size="sm" variant="soft">
                                                    MCP
                                                </Chip>
                                            </span>
                                        </ItemCard.Title>
                                        <ItemCard.Description>
                                            {`${connection.tools.length} tools · ${connection.url}`}
                                        </ItemCard.Description>
                                    </ItemCard.Content>
                                    <ItemCard.Action>
                                        <Switch
                                            aria-label={`Enable ${connection.name} for ${agent.displayName}`}
                                            isDisabled={grant.isPending}
                                            isSelected={checked}
                                            onChange={(enabled) =>
                                                grant.setGrant(connection.id, enabled)
                                            }
                                        >
                                            <Switch.Content>
                                                <Switch.Control>
                                                    <Switch.Thumb />
                                                </Switch.Control>
                                            </Switch.Content>
                                        </Switch>
                                    </ItemCard.Action>
                                </ItemCard>
                            </React.Fragment>
                        );
                    })
                )}
            </ItemCardGroup>
        </SettingsSection>
    );
}
