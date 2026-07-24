import * as React from 'react';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput, McpConnectionListOutput } from '../../../lib/trpc.tsx';
import { trpc } from '../../../lib/trpc.tsx';
import { SectionMessage } from './skills-section.tsx';

type Connection = McpConnectionListOutput['connections'][number];

export function AgentAppsTab({ agent }: { agent: AgentListOutput['agents'][number] }) {
    const connections = trpc.mcp.list.useQuery();
    const grants = trpc.mcp.agentGrants.useQuery({ agentId: agent.id });
    const visibleConnections =
        connections.data?.connections.filter(
            (connection) =>
                connection.connected ||
                grants.data?.grants.some((grant) => grant.connectionId === connection.id)
        ) ?? [];

    return (
        <div className="mx-auto w-full max-w-3xl py-6">
            <HostTools agentId={agent.id} />
            <SettingsSection title="Tools">
                {connections.isPending || grants.isPending ? (
                    <SectionMessage>Loading tools...</SectionMessage>
                ) : connections.isError || grants.isError ? (
                    <SectionMessage>
                        {connections.error?.message ??
                            grants.error?.message ??
                            'Could not load tool grants.'}
                    </SectionMessage>
                ) : visibleConnections.length > 0 ? (
                    <div className="grid gap-5">
                        {visibleConnections.map((connection) => (
                            <ConnectionTools
                                agentId={agent.id}
                                connection={connection}
                                grants={grants.data?.grants ?? []}
                                key={connection.id}
                            />
                        ))}
                    </div>
                ) : (
                    <SectionMessage>
                        Connect an MCP server in Settings → Connections.
                    </SectionMessage>
                )}
            </SettingsSection>
        </div>
    );
}

function HostTools({ agentId }: { agentId: string }) {
    const tools = trpc.mcp.agentHostTools.useQuery({ agentId });
    const utils = trpc.useUtils();
    const setGrant = trpc.mcp.setAgentHostToolGrant.useMutation({
        async onSuccess() {
            await utils.mcp.agentHostTools.invalidate({ agentId });
        },
    });
    return (
        <SettingsSection title="Built in">
            {tools.isPending ? (
                <SectionMessage>Loading built-in tools...</SectionMessage>
            ) : tools.isError ? (
                <SectionMessage>{tools.error.message}</SectionMessage>
            ) : tools.data ? (
                <SettingsGroup>
                    {tools.data.tools.map((hostTool, index) => (
                        <React.Fragment key={hostTool.id}>
                            {index > 0 ? <Separator /> : null}
                            <SettingsRow
                                description={
                                    hostTool.available
                                        ? hostTool.description
                                        : `${hostTool.description} Currently unavailable.`
                                }
                                title={hostTool.name}
                                trailingWidth="intrinsic"
                            >
                                <Switch
                                    aria-label={`Grant ${hostTool.name}`}
                                    checked={hostTool.granted}
                                    disabled={setGrant.isPending}
                                    onCheckedChange={(enabled) =>
                                        void withSavingToast(() =>
                                            setGrant.mutateAsync({
                                                agentId,
                                                grant: { enabled },
                                                toolId: hostTool.id,
                                            })
                                        ).catch(() => undefined)
                                    }
                                />
                            </SettingsRow>
                        </React.Fragment>
                    ))}
                </SettingsGroup>
            ) : (
                <SectionMessage>Could not load built-in tools.</SectionMessage>
            )}
        </SettingsSection>
    );
}

function ConnectionTools({
    agentId,
    connection,
    grants,
}: {
    agentId: string;
    connection: Connection;
    grants: Array<{ connectionId: string; toolName: string }>;
}) {
    const tools = trpc.mcp.connectionTools.useQuery(
        { connectionId: connection.id },
        { enabled: connection.connected, retry: false }
    );
    const utils = trpc.useUtils();
    const setGrant = trpc.mcp.setAgentToolGrant.useMutation({
        async onSuccess() {
            await utils.mcp.agentGrants.invalidate({ agentId });
        },
    });
    const grantedNames = new Set(
        grants
            .filter((grant) => grant.connectionId === connection.id)
            .map((grant) => grant.toolName)
    );
    const reportedTools = tools.data?.tools ?? [];
    const reportedNames = new Set(reportedTools.map((tool) => tool.name));
    const displayedTools = [
        ...reportedTools.map((tool) => ({ ...tool, available: true })),
        ...[...grantedNames]
            .filter((name) => !reportedNames.has(name))
            .map((name) => ({
                available: false,
                description: connection.connected
                    ? 'This server no longer reports this tool.'
                    : 'Unavailable until this connection is restored.',
                name,
                title: null,
            })),
    ];

    return (
        <SettingsSection title={connection.name}>
            {connection.connected && tools.isPending && displayedTools.length === 0 ? (
                <SectionMessage>Loading {connection.name} tools...</SectionMessage>
            ) : (
                <>
                    {tools.isError ? <SectionMessage>{tools.error.message}</SectionMessage> : null}
                    {displayedTools.length > 0 ? (
                        <SettingsGroup>
                            {displayedTools.map((tool, index) => (
                                <React.Fragment key={tool.name}>
                                    {index > 0 ? <Separator /> : null}
                                    <SettingsRow
                                        description={
                                            tool.available
                                                ? tool.description || tool.name
                                                : `${tool.description} You can remove its existing grant.`
                                        }
                                        title={tool.title ?? tool.name}
                                        trailingWidth="intrinsic"
                                    >
                                        <Switch
                                            aria-label={`Grant ${tool.name}`}
                                            checked={grantedNames.has(tool.name)}
                                            disabled={
                                                setGrant.isPending ||
                                                !(tool.available || grantedNames.has(tool.name))
                                            }
                                            onCheckedChange={(enabled) =>
                                                void withSavingToast(() =>
                                                    setGrant.mutateAsync({
                                                        agentId,
                                                        connectionId: connection.id,
                                                        grant: { enabled },
                                                        toolName: tool.name,
                                                    })
                                                ).catch(() => undefined)
                                            }
                                        />
                                    </SettingsRow>
                                </React.Fragment>
                            ))}
                        </SettingsGroup>
                    ) : tools.isError ? null : (
                        <SectionMessage>No tools reported.</SectionMessage>
                    )}
                </>
            )}
        </SettingsSection>
    );
}
