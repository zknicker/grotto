import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../components/ui/settings-row.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import { RequireOperator } from '../../features/servers/require-operator.tsx';
import { serverRoute } from '../../features/servers/server-routes.ts';
import { McpConnectionDetailDialog } from '../../features/settings/mcp/mcp-connection-detail-dialog.tsx';
import {
    ConnectionFilters,
    ConnectionRow,
} from '../../features/settings/mcp/mcp-connection-list.tsx';
import { McpConnectionFormDrawer } from '../../features/settings/mcp/mcp-server-form.tsx';
import type {
    McpConnection,
    McpConnectionFilter,
    McpConnectionSaveInput,
} from '../../features/settings/mcp/mcp-server-shared.ts';
import { visibleConnections } from '../../features/settings/mcp/mcp-server-shared.ts';
import { useServer } from '../../hooks/servers/use-server.ts';
import { getGrottoServerOrigin, grottoTrpc } from '../../lib/grotto-server.tsx';
import {
    HostedMcpPresetButtons,
    HostedMcpTrustDialog,
    toHostedMcpView,
} from './hosted-mcp-view.tsx';

export function ServerConnectionsPage({ embedded = false }: { embedded?: boolean }) {
    const { slug = '' } = useParams();
    const server = useServer(slug);
    const [filter, setFilter] = React.useState<McpConnectionFilter>('all');
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [retryMessage, setRetryMessage] = React.useState<string | null>(null);
    const [trustRequest, setTrustRequest] = React.useState<{
        connection: McpConnection;
        origin: string;
    } | null>(null);
    const [connectingId, setConnectingId] = React.useState<string | null>(null);
    const connections = grottoTrpc.mcp.list.useQuery(
        { serverId: server.data?.id ?? '' },
        { enabled: Boolean(server.data) }
    );
    const agents = grottoTrpc.agent.list.useQuery(
        { serverId: server.data?.id ?? '' },
        { enabled: Boolean(server.data) }
    );
    const utils = grottoTrpc.useUtils();
    const invalidate = () => utils.mcp.list.invalidate();
    const add = grottoTrpc.mcp.add.useMutation({ onSuccess: invalidate });
    const addPreset = grottoTrpc.mcp.addPresetAccount.useMutation({ onSuccess: invalidate });
    const disconnect = grottoTrpc.mcp.disconnect.useMutation({ onSuccess: invalidate });
    const remove = grottoTrpc.mcp.delete.useMutation({ onSuccess: invalidate });
    const refresh = grottoTrpc.mcp.refresh.useMutation({ onSuccess: invalidate });
    const replaceHeaders = grottoTrpc.mcp.replaceHeaders.useMutation({ onSuccess: invalidate });
    const startOAuth = grottoTrpc.mcp.startOAuth.useMutation();
    const viewConnections = (connections.data ?? []).map((connection) =>
        toHostedMcpView(connection, agents.data ?? [])
    );
    const selectedConnection =
        viewConnections.find((connection) => connection.id === selectedId) ?? null;
    const selectedHosted = connections.data?.find((connection) => connection.id === selectedId);

    React.useEffect(() => {
        if (
            connectingId &&
            connections.data?.some((item) => item.id === connectingId && item.connected)
        ) {
            setConnectingId(null);
        }
    }, [connectingId, connections.data]);

    if (!server.data) {
        return null;
    }

    const startConnectionOAuth = async (
        connection: McpConnection,
        allowAuthorizationServerOrigin = false
    ) => {
        setRetryMessage(null);
        const popup = window.open('about:blank', '_blank');
        if (popup) {
            popup.opener = null;
        }
        try {
            const result = await startOAuth.mutateAsync({
                allowAuthorizationServerOrigin,
                connectionId: connection.id,
                redirectUrl: new URL('/mcp/oauth/callback', getGrottoServerOrigin()).toString(),
                serverId: server.data.id,
            });
            if (result.status === 'trust-required') {
                popup?.close();
                setTrustRequest({ connection, origin: result.authorizationServerOrigin });
                return;
            }
            setConnectingId(connection.id);
            if (popup) {
                popup.location.href = result.authorizationUrl;
            } else {
                window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (cause) {
            popup?.close();
            const message = cause instanceof Error ? cause.message : 'Try again.';
            setRetryMessage(message);
            toastManager.add({ description: message, title: 'Connection failed', type: 'error' });
        }
    };
    const saveCustom = async (input: McpConnectionSaveInput) => {
        try {
            await add.mutateAsync({
                ...input,
                headers: input.headers ?? {},
                oauthScopes: input.oauthScopes ?? [],
                serverId: server.data.id,
            });
            setIsAddOpen(false);
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Try again.';
            setRetryMessage(message);
            toastManager.add({ description: message, title: 'Connection failed', type: 'error' });
        }
    };

    return (
        <RequireOperator
            description="MCP connections are managed by Server operators."
            role={server.data.role}
        >
            <SettingsPage>
                {embedded ? null : (
                    <Link
                        className="text-muted-foreground text-sm hover:text-foreground"
                        to={serverRoute(slug)}
                    >
                        Back to /{slug}
                    </Link>
                )}
                <SettingsPageHeader
                    action={<Button onClick={() => setIsAddOpen(true)}>Add MCP server</Button>}
                    description="Connect remote tools to this Server, then enable each connection for the Agents that need it."
                    title="MCP Servers"
                />
                <SettingsSection title="Recommended">
                    <HostedMcpPresetButtons
                        onAdd={(preset, name) =>
                            addPreset.mutate({
                                name,
                                preset,
                                serverId: server.data.id,
                            })
                        }
                    />
                </SettingsSection>
                {retryMessage ? (
                    <Alert className="mx-3 w-auto" variant="error">
                        <AlertDescription>{retryMessage}</AlertDescription>
                    </Alert>
                ) : null}
                <SettingsSection title="MCP connections">
                    <div className="px-3">
                        <ConnectionFilters filter={filter} onChange={setFilter} />
                    </div>
                    <SettingsGroup>
                        <div className="grid grid-cols-[minmax(0,1fr)_7rem_8rem] border-border-subtle border-b bg-muted px-5 py-2 text-meta text-muted-foreground">
                            <span>Connection</span>
                            <span>Type</span>
                            <span>Status</span>
                        </div>
                        {visibleConnections(viewConnections, filter).map((connection) => (
                            <ConnectionRow
                                connection={connection}
                                key={connection.id}
                                onSelect={() => setSelectedId(connection.id)}
                            />
                        ))}
                        {!connections.isPending && viewConnections.length === 0 ? (
                            <p className="px-5 py-8 text-center text-muted-foreground text-sm">
                                No connections.
                            </p>
                        ) : null}
                    </SettingsGroup>
                </SettingsSection>
                <McpConnectionDetailDialog
                    connection={selectedConnection}
                    onAddAccount={(connection) => {
                        if (connection.preset) {
                            addPreset.mutate({
                                name: `${connection.name} account`,
                                preset: connection.preset,
                                serverId: server.data.id,
                            });
                        }
                    }}
                    onDelete={(connection) =>
                        remove.mutate({ connectionId: connection.id, serverId: server.data.id })
                    }
                    onDisconnect={(connection) =>
                        disconnect.mutate({ connectionId: connection.id, serverId: server.data.id })
                    }
                    onOpenChange={(open) => !open && setSelectedId(null)}
                    onRefresh={async (connection) => {
                        await refresh.mutateAsync({
                            connectionId: connection.id,
                            serverId: server.data.id,
                        });
                    }}
                    onStartOAuth={(connection) => void startConnectionOAuth(connection)}
                    onUpdateHeaders={(connection, headers) =>
                        replaceHeaders
                            .mutateAsync({
                                connectionId: connection.id,
                                headers,
                                serverId: server.data.id,
                            })
                            .then(() => undefined)
                    }
                    open={selectedConnection !== null}
                    saving={add.isPending || addPreset.isPending || startOAuth.isPending}
                    startingOAuthId={
                        startOAuth.isPending ? (startOAuth.variables?.connectionId ?? null) : null
                    }
                    tools={(selectedHosted?.tools ?? []).map((name) => ({
                        description: '',
                        name,
                        title: null,
                    }))}
                    toolsError={null}
                    toolsPending={Boolean(connectingId === selectedId)}
                />
                {isAddOpen ? (
                    <McpConnectionFormDrawer
                        onOpenChange={setIsAddOpen}
                        onSave={saveCustom}
                        open
                        saving={add.isPending}
                    />
                ) : null}
                <HostedMcpTrustDialog
                    onClose={() => setTrustRequest(null)}
                    onConfirm={() => {
                        if (trustRequest) {
                            void startConnectionOAuth(trustRequest.connection, true);
                        }
                    }}
                    request={trustRequest}
                />
            </SettingsPage>
        </RequireOperator>
    );
}
