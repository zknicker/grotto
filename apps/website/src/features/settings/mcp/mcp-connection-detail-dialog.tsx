import { Alert, Button, Modal, Separator, Spinner, Surface } from '@heroui/react';
import { Fragment, useState } from 'react';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import {
    ConnectionDestructiveDialog,
    ConnectionMenu,
    type McpDestructiveAction,
} from './mcp-connection-actions.tsx';
import { McpHeaderCredentialsDialog } from './mcp-header-credentials-dialog.tsx';
import {
    connectionSummary,
    type McpConnection,
    type McpConnectionTool,
} from './mcp-server-shared.ts';

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
    tools,
    toolsError,
    toolsPending,
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
    tools: McpConnectionTool[] | null;
    toolsError: string | null;
    toolsPending: boolean;
}) {
    const [destructiveAction, setDestructiveAction] = useState<McpDestructiveAction | null>(null);
    const [editingHeaders, setEditingHeaders] = useState(false);
    const [pendingHeaders, setPendingHeaders] = useState<Record<string, string> | null>(null);
    if (!connection) {
        return null;
    }

    return (
        <>
            <Modal isOpen={open} onOpenChange={onOpenChange}>
                <Modal.Backdrop isDismissable>
                    <Modal.Container scroll="outside" size="lg">
                        <Modal.Dialog>
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Icon className="bg-default text-foreground">
                                    {connection.name.slice(0, 1).toUpperCase()}
                                </Modal.Icon>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Modal.Heading>{connection.name}</Modal.Heading>
                                        <p className="mt-1.5 text-muted text-sm leading-5">
                                            {connection.accountLabel ??
                                                (connection.builtIn
                                                    ? 'Built-in MCP connection'
                                                    : 'Custom MCP connection')}
                                        </p>
                                    </div>
                                    <ConnectionMenu
                                        connection={connection}
                                        disabled={saving}
                                        onAddAccount={() => onAddAccount(connection)}
                                        onDelete={() => setDestructiveAction('delete')}
                                        onDisconnect={() => setDestructiveAction('disconnect')}
                                        onRefresh={() => {
                                            void onRefresh(connection).catch(() => undefined);
                                        }}
                                    />
                                </div>
                            </Modal.Header>
                            <Modal.Body>
                                <div className="grid gap-6">
                                    <Surface
                                        className="flex items-center justify-between gap-4 rounded-2xl p-4"
                                        variant="secondary"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-mono text-muted text-xs">
                                                {connectionSummary(connection)}
                                            </p>
                                            <p className="mt-1 flex items-center gap-2 text-sm">
                                                <StatusDot
                                                    status={
                                                        connection.connected ? 'success' : 'muted'
                                                    }
                                                />
                                                {connection.connected
                                                    ? 'Connected'
                                                    : 'Not connected'}
                                            </p>
                                        </div>
                                        {connection.auth === 'oauth' ? (
                                            <Button
                                                isDisabled={saving}
                                                isPending={startingOAuthId === connection.id}
                                                onPress={() => onStartOAuth(connection)}
                                                variant={
                                                    connection.connected ? 'secondary' : 'primary'
                                                }
                                            >
                                                {connection.connected ? 'Reconnect' : 'Connect'}
                                            </Button>
                                        ) : null}
                                        {connection.auth === 'headers' ? (
                                            <Button
                                                isDisabled={saving}
                                                onPress={() => setEditingHeaders(true)}
                                                variant={
                                                    connection.connected ? 'secondary' : 'primary'
                                                }
                                            >
                                                {connection.connected
                                                    ? 'Replace Credentials'
                                                    : 'Connect'}
                                            </Button>
                                        ) : null}
                                    </Surface>

                                    <section className="grid gap-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-medium text-sm">
                                                    Available Tools
                                                </h3>
                                                <p className="text-muted text-xs">
                                                    Enabled Agents receive every tool listed here.
                                                </p>
                                            </div>
                                            {toolsPending ? <Spinner size="sm" /> : null}
                                        </div>
                                        <Surface
                                            className="overflow-hidden rounded-2xl"
                                            variant="secondary"
                                        >
                                            <ToolList
                                                connection={connection}
                                                error={toolsError}
                                                pending={toolsPending}
                                                tools={tools}
                                            />
                                        </Surface>
                                    </section>

                                    <section className="grid gap-2">
                                        <div>
                                            <h3 className="font-medium text-sm">Agent Access</h3>
                                            <p className="text-muted text-xs">
                                                Access is enabled per MCP server from each Agent
                                                profile.
                                            </p>
                                        </div>
                                        <Surface
                                            className="overflow-hidden rounded-2xl"
                                            variant="secondary"
                                        >
                                            {connection.affectedAgents.length > 0 ? (
                                                connection.affectedAgents.map((agent, index) => (
                                                    <Fragment key={agent.id}>
                                                        {index > 0 ? (
                                                            <Separator variant="secondary" />
                                                        ) : null}
                                                        <div className="px-4 py-3 text-sm">
                                                            {agent.name}
                                                        </div>
                                                    </Fragment>
                                                ))
                                            ) : (
                                                <p className="px-4 py-4 text-muted text-sm">
                                                    No agents have access yet.
                                                </p>
                                            )}
                                        </Surface>
                                    </section>
                                </div>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button slot="close" variant="secondary">
                                    Done
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
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
            <p className="px-4 py-4 text-muted text-sm">Connect this server to load its tools.</p>
        );
    }
    if (pending) {
        return <p className="px-4 py-4 text-muted text-sm">Loading tools…</p>;
    }
    if (error) {
        return (
            <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                    <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
            </Alert>
        );
    }
    if (!tools || tools.length === 0) {
        return <p className="px-4 py-4 text-muted text-sm">No tools reported.</p>;
    }
    return tools.map((tool, index) => (
        <Fragment key={tool.name}>
            {index > 0 ? <Separator variant="secondary" /> : null}
            <div className="px-4 py-3">
                <p className="font-medium text-sm">{tool.title ?? tool.name}</p>
                <p className="truncate text-muted text-xs">{tool.description}</p>
            </div>
        </Fragment>
    ));
}
