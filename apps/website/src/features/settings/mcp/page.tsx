import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogClose,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogPopup,
    AlertDialogTitle,
} from '../../../components/ui/alert-dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { toastManager } from '../../../components/ui/toast.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { trpc } from '../../../lib/trpc.tsx';
import { McpConnectionDetailDialog } from './mcp-connection-detail-dialog.tsx';
import { ConnectionFilters, ConnectionRow } from './mcp-connection-list.tsx';
import { McpConnectionFormDrawer } from './mcp-server-form.tsx';
import {
    type McpConnection,
    type McpConnectionFilter,
    visibleConnections,
} from './mcp-server-shared.ts';
import { useMcpConnections } from './use-mcp-servers.ts';

export function McpSettingsPage() {
    const state = useMcpConnections();
    const [filter, setFilter] = useState<McpConnectionFilter>('all');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [trustRequest, setTrustRequest] = useState<{
        connection: McpConnection;
        origin: string;
    } | null>(null);
    const selectedConnection =
        state.connections.find((connection) => connection.id === selectedId) ?? null;
    const tools = trpc.mcp.connectionTools.useQuery(
        { connectionId: selectedConnection?.id ?? '' },
        { enabled: Boolean(selectedConnection?.connected), retry: false }
    );
    const filteredConnections = visibleConnections(state.connections, filter);

    const startOAuth = async (
        connection: McpConnection,
        allowAuthorizationServerOrigin = false
    ) => {
        const popup = window.open('about:blank', '_blank');
        if (popup) {
            popup.opener = null;
        }
        try {
            const result = await state.startOAuth({
                allowAuthorizationServerOrigin,
                connectionId: connection.id,
            });
            if (result.status === 'trust-required') {
                popup?.close();
                setTrustRequest({
                    connection,
                    origin: result.authorizationServerOrigin,
                });
                return;
            }
            if (popup) {
                popup.location.href = result.authorizationUrl;
            } else {
                window.open(result.authorizationUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (error) {
            popup?.close();
            toastManager.add({
                description: error instanceof Error ? error.message : 'Try again.',
                title: 'Connection failed',
                type: 'error',
            });
        }
    };

    return (
        <SettingsPage>
            <SettingsPageHeader
                action={<Button onClick={() => setIsAddOpen(true)}>Add connection</Button>}
                description="Connect MCP servers, then choose each agent’s tools from its profile."
                title="Connections"
            />
            <SettingsSection title="MCP connections">
                <div className="px-3">
                    <ConnectionFilters filter={filter} onChange={setFilter} />
                </div>
                <SettingsGroup>
                    {state.listError ? (
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                            <p className="text-destructive-foreground text-sm">
                                Could not load connections. {state.listError}
                            </p>
                            <Button onClick={() => void state.refetch()} variant="secondary">
                                Retry
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-[minmax(0,1fr)_7rem_8rem] border-border/50 border-b bg-muted/30 px-5 py-2 text-meta text-muted-foreground">
                                <span>Connection</span>
                                <span>Type</span>
                                <span>Status</span>
                            </div>
                            <div>
                                {filteredConnections.map((connection) => (
                                    <ConnectionRow
                                        connection={connection}
                                        key={connection.id}
                                        onSelect={() => setSelectedId(connection.id)}
                                    />
                                ))}
                            </div>
                            {state.isLoading ? (
                                <p className="px-5 py-4 text-muted-foreground text-sm">
                                    Loading connections…
                                </p>
                            ) : null}
                            {!state.isLoading && filteredConnections.length === 0 ? (
                                <p className="px-5 py-8 text-center text-muted-foreground text-sm">
                                    {filter === 'all'
                                        ? 'No connections.'
                                        : `No ${filter === 'connected' ? 'connected' : 'disconnected'} connections.`}
                                </p>
                            ) : null}
                        </>
                    )}
                </SettingsGroup>
            </SettingsSection>
            <McpConnectionDetailDialog
                connection={selectedConnection}
                onAddAccount={(connection) => {
                    const preset = connection.preset;
                    if (!preset) {
                        return;
                    }
                    void withSavingToast(() =>
                        state.addPresetAccount({
                            name: `${connection.name} account`,
                            preset,
                        })
                    ).catch(() => undefined);
                }}
                onDelete={(connection) =>
                    void withSavingToast(() => state.remove({ connectionId: connection.id }))
                        .then(() => setSelectedId(null))
                        .catch(() => undefined)
                }
                onDisconnect={(connection) =>
                    void withSavingToast(() =>
                        state.disconnect({ connectionId: connection.id })
                    ).catch(() => undefined)
                }
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedId(null);
                    }
                }}
                onRefresh={(connection) =>
                    withSavingToast(() => state.refresh({ connectionId: connection.id })).then(
                        () => undefined
                    )
                }
                onStartOAuth={startOAuth}
                onUpdateHeaders={(connection, headers) =>
                    withSavingToast(() =>
                        state.update({
                            connection: { headers },
                            connectionId: connection.id,
                        })
                    ).then(() => undefined)
                }
                open={selectedConnection !== null}
                saving={state.isSaving}
                startingOAuthId={state.startingOAuthId}
                tools={tools.data?.tools ?? null}
                toolsError={tools.error?.message ?? null}
                toolsPending={tools.isFetching}
            />
            {isAddOpen ? (
                <McpConnectionFormDrawer
                    onOpenChange={setIsAddOpen}
                    onSave={(input) =>
                        void withSavingToast(() => state.add(input))
                            .then(() => setIsAddOpen(false))
                            .catch(() => undefined)
                    }
                    open
                    saving={state.isSaving}
                />
            ) : null}
            <TrustAuthorizationServerDialog
                onConfirm={() => {
                    if (trustRequest) {
                        void startOAuth(trustRequest.connection, true);
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setTrustRequest(null);
                    }
                }}
                request={trustRequest}
            />
        </SettingsPage>
    );
}

function TrustAuthorizationServerDialog({
    onConfirm,
    onOpenChange,
    request,
}: {
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    request: { connection: McpConnection; origin: string } | null;
}) {
    return (
        <AlertDialog onOpenChange={onOpenChange} open={request !== null}>
            <AlertDialogPopup>
                <AlertDialogHeader>
                    <AlertDialogTitle>Trust this sign-in service?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {request?.connection.name} uses{' '}
                        <span className="font-mono">{request?.origin}</span> for sign-in. Continue
                        only if you recognize this service.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
                    <AlertDialogClose onClick={onConfirm} render={<Button />}>
                        Trust and continue
                    </AlertDialogClose>
                </AlertDialogFooter>
            </AlertDialogPopup>
        </AlertDialog>
    );
}
