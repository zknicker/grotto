import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../components/ui/settings-row.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
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

export function ServerConnectionsPage() {
    const { slug = '' } = useParams();
    const server = useServer(slug);
    const [computerId, setComputerId] = React.useState('');
    const [filter, setFilter] = React.useState<McpConnectionFilter>('all');
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [retryMessage, setRetryMessage] = React.useState<string | null>(null);
    const [trustRequest, setTrustRequest] = React.useState<{
        connection: McpConnection;
        origin: string;
    } | null>(null);
    const [connectingId, setConnectingId] = React.useState<string | null>(null);
    const computers = grottoTrpc.computer.list.useQuery(
        { serverId: server.data?.id ?? '' },
        { enabled: Boolean(server.data) }
    );
    const connections = grottoTrpc.mcp.list.useQuery(
        { serverId: server.data?.id ?? '' },
        { enabled: Boolean(server.data), refetchInterval: connectingId ? 1000 : 4000 }
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
    const selectedComputerId = computerId || computers.data?.[0]?.id || '';
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
    if (server.data.role === 'member') {
        return (
            <main className="grid min-h-dvh place-content-center text-muted-foreground text-sm">
                Owner or Admin required.
            </main>
        );
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
        if (!selectedComputerId) {
            setRetryMessage('Choose an online Computer and try again.');
            return;
        }
        try {
            await add.mutateAsync({
                ...input,
                args: input.args ?? [],
                computerId: selectedComputerId,
                env: input.env ?? {},
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
        <SettingsPage>
            <Link
                className="text-muted-foreground text-sm hover:text-foreground"
                to={serverRoute(slug)}
            >
                Back to /{slug}
            </Link>
            <SettingsPageHeader
                action={<Button onClick={() => setIsAddOpen(true)}>Add connection</Button>}
                description="Connect MCP servers, then choose each agent’s tools from its profile."
                title="Connections"
            />
            <SettingsSection title="Run on">
                <SettingsGroup>
                    <div className="p-4">
                        <Select
                            items={(computers.data ?? []).map((computer) => ({
                                label: `${computer.operatingSystem ?? 'Computer'} · ${computer.health}`,
                                value: computer.id,
                            }))}
                            onValueChange={(value) => setComputerId(value ?? '')}
                            value={selectedComputerId}
                        >
                            <SelectTrigger aria-label="Computer">
                                <SelectValue placeholder="Choose a Computer" />
                            </SelectTrigger>
                            <SelectContent>
                                {(computers.data ?? []).map((computer) => (
                                    <SelectItem key={computer.id} value={computer.id}>
                                        {computer.operatingSystem ?? 'Computer'} · {computer.health}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </SettingsGroup>
            </SettingsSection>
            <SettingsSection title="Built-in presets">
                <HostedMcpPresetButtons
                    computerId={selectedComputerId}
                    onAdd={(preset, name) =>
                        addPreset.mutate({
                            computerId: selectedComputerId,
                            name,
                            preset,
                            serverId: server.data.id,
                        })
                    }
                />
            </SettingsSection>
            {retryMessage ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive-foreground text-sm">
                    {retryMessage}
                </p>
            ) : null}
            <SettingsSection title="MCP connections">
                <div className="px-3">
                    <ConnectionFilters filter={filter} onChange={setFilter} />
                </div>
                <SettingsGroup>
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem_8rem] border-border/50 border-b bg-muted/30 px-5 py-2 text-meta text-muted-foreground">
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
                    if (connection.preset && selectedComputerId) {
                        addPreset.mutate({
                            computerId: selectedComputerId,
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
    );
}
