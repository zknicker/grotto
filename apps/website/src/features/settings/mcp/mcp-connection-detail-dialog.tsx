import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import { type McpConnectionTool, trpc } from '../../../lib/trpc.tsx';
import {
    ConnectionDestructiveDialog,
    ConnectionMenu,
    type McpDestructiveAction,
} from './mcp-connection-actions.tsx';
import { McpHeaderCredentialsDialog } from './mcp-header-credentials-dialog.tsx';
import { connectionSummary, type McpConnection } from './mcp-server-shared.ts';

export function McpConnectionDetailDialog({
    connection,
    onAddAccount,
    onDelete,
    onDisconnect,
    onOpenChange,
    onRefresh,
    onStartOAuth,
    onUpdateHeaders,
    open,
    saving,
    startingOAuthId,
}: {
    connection: McpConnection | null;
    onAddAccount: (connection: McpConnection) => void;
    onDelete: (connection: McpConnection) => void;
    onDisconnect: (connection: McpConnection) => void;
    onOpenChange: (open: boolean) => void;
    onRefresh: (connection: McpConnection) => Promise<void>;
    onStartOAuth: (connection: McpConnection) => void;
    onUpdateHeaders: (connection: McpConnection, headers: Record<string, string>) => Promise<void>;
    open: boolean;
    saving: boolean;
    startingOAuthId: string | null;
}) {
    const [destructiveAction, setDestructiveAction] = useState<McpDestructiveAction | null>(null);
    const [editingHeaders, setEditingHeaders] = useState(false);
    const [pendingHeaders, setPendingHeaders] = useState<Record<string, string> | null>(null);
    const tools = trpc.mcp.connectionTools.useQuery(
        { connectionId: connection?.id ?? '' },
        { enabled: Boolean(connection?.connected && open), retry: false }
    );

    if (!connection) {
        return null;
    }

    return (
        <>
            <Dialog onOpenChange={onOpenChange} open={open}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <div className="flex items-start gap-3 pe-16">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted font-semibold text-foreground">
                                {connection.name.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <DialogTitle>{connection.name}</DialogTitle>
                                <DialogDescription>
                                    {connection.accountLabel ??
                                        (connection.builtIn
                                            ? 'Built-in MCP connection'
                                            : 'Custom MCP connection')}
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="absolute top-3 right-12">
                            <ConnectionMenu
                                connection={connection}
                                disabled={saving}
                                onAddAccount={() => onAddAccount(connection)}
                                onDelete={() => setDestructiveAction('delete')}
                                onDisconnect={() => setDestructiveAction('disconnect')}
                                onRefresh={() => {
                                    void onRefresh(connection)
                                        .then(() => tools.refetch())
                                        .catch(() => undefined);
                                }}
                            />
                        </div>
                    </DialogHeader>
                    <DialogPanel className="grid gap-6">
                        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-3.5">
                            <div className="min-w-0">
                                <p className="truncate font-mono text-meta text-muted-foreground">
                                    {connectionSummary(connection)}
                                </p>
                                <p className="mt-1 flex items-center gap-2 text-sm">
                                    <span
                                        className={
                                            connection.connected
                                                ? 'size-2 rounded-full bg-success'
                                                : 'size-2 rounded-full bg-muted-foreground/40'
                                        }
                                    />
                                    {connection.connected ? 'Connected' : 'Not connected'}
                                </p>
                            </div>
                            {connection.auth === 'oauth' ? (
                                <Button
                                    disabled={saving}
                                    loading={startingOAuthId === connection.id}
                                    onClick={() => onStartOAuth(connection)}
                                    variant={connection.connected ? 'secondary' : 'default'}
                                >
                                    {connection.connected ? 'Reconnect' : 'Connect'}
                                </Button>
                            ) : null}
                            {connection.auth === 'headers' ? (
                                <Button
                                    disabled={saving}
                                    onClick={() => setEditingHeaders(true)}
                                    variant={connection.connected ? 'secondary' : 'default'}
                                >
                                    {connection.connected ? 'Replace credentials' : 'Connect'}
                                </Button>
                            ) : null}
                        </div>

                        <section className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-sm">Available tools</h3>
                                    <p className="text-meta text-muted-foreground">
                                        Agents only receive tools granted from their Tools tab.
                                    </p>
                                </div>
                                {tools.isFetching ? <Spinner className="size-4" /> : null}
                            </div>
                            <div className="overflow-hidden rounded-xl border border-border/70">
                                <ToolList
                                    connection={connection}
                                    error={tools.error?.message ?? null}
                                    pending={tools.isPending}
                                    tools={tools.data?.tools ?? null}
                                />
                            </div>
                        </section>

                        <section className="grid gap-2">
                            <div>
                                <h3 className="font-medium text-sm">Agent access</h3>
                                <p className="text-meta text-muted-foreground">
                                    Exact grants are managed separately for each agent.
                                </p>
                            </div>
                            <div className="overflow-hidden rounded-xl border border-border/70">
                                {connection.affectedAgents.length > 0 ? (
                                    connection.affectedAgents.map((agent) => (
                                        <div
                                            className="border-border/50 border-b px-3.5 py-3 text-sm last:border-b-0"
                                            key={agent.id}
                                        >
                                            {agent.name}
                                        </div>
                                    ))
                                ) : (
                                    <p className="px-3.5 py-4 text-muted-foreground text-sm">
                                        No agents have access yet.
                                    </p>
                                )}
                            </div>
                        </section>
                    </DialogPanel>
                </DialogContent>
            </Dialog>
            <ConnectionDestructiveDialog
                action={destructiveAction}
                connection={connection}
                onConfirm={() => {
                    if (destructiveAction === 'delete') {
                        onDelete(connection);
                    } else if (destructiveAction === 'disconnect') {
                        onDisconnect(connection);
                    } else if (destructiveAction === 'replace-credentials' && pendingHeaders) {
                        void onUpdateHeaders(connection, pendingHeaders).catch(() => undefined);
                    }
                    setPendingHeaders(null);
                    setDestructiveAction(null);
                }}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setDestructiveAction(null);
                    }
                }}
            />
            <McpHeaderCredentialsDialog
                connection={connection}
                onOpenChange={setEditingHeaders}
                onSave={async (headers) => {
                    if (connection.affectedAgents.length > 0) {
                        setPendingHeaders(headers);
                        setEditingHeaders(false);
                        setDestructiveAction('replace-credentials');
                        return;
                    }
                    await onUpdateHeaders(connection, headers);
                    setEditingHeaders(false);
                }}
                open={editingHeaders}
                saving={saving}
            />
        </>
    );
}

function ToolList({
    connection,
    error,
    pending,
    tools,
}: {
    connection: McpConnection;
    error: string | null;
    pending: boolean;
    tools: McpConnectionTool[] | null;
}) {
    if (!connection.connected) {
        return (
            <p className="px-3.5 py-4 text-muted-foreground text-sm">
                Connect this server to load its tools.
            </p>
        );
    }
    if (pending) {
        return <p className="px-3.5 py-4 text-muted-foreground text-sm">Loading tools…</p>;
    }
    if (error) {
        return <p className="px-3.5 py-4 text-destructive-foreground text-sm">{error}</p>;
    }
    if (!tools || tools.length === 0) {
        return <p className="px-3.5 py-4 text-muted-foreground text-sm">No tools reported.</p>;
    }
    return tools.map((tool) => (
        <div className="border-border/50 border-b px-3.5 py-3 last:border-b-0" key={tool.name}>
            <p className="font-medium text-sm">{tool.title ?? tool.name}</p>
            <p className="truncate text-meta text-muted-foreground">{tool.description}</p>
        </div>
    ));
}
