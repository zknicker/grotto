import { Alert, Button, Chip, Modal, Separator, Spinner, Tooltip } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import { ArrowReloadHorizontalIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Fragment, type ReactNode, useState } from 'react';
import { useResolvedThemeOptional } from '../../../components/theme-provider.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { connectionIcon } from './connection-icon.ts';
import {
    ConnectionDestructiveDialog,
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
                    {/* A server can expose dozens of tools. `outside` — the
                        house default for bounded dialogs — would grow this one
                        without limit; `inside` caps the dialog and scrolls the
                        body, keeping the identity header and the actions
                        reachable at any tool count. */}
                    <Modal.Container scroll="inside" size="lg">
                        <Modal.Dialog>
                            <Modal.CloseTrigger />
                            {/* Modal.Header stacks: icon, heading, then one
                                muted line. Anything laid out across it fights
                                the component, which is what left the mark
                                stranded on its own row. */}
                            <Modal.Header>
                                <Modal.Icon className="overflow-hidden bg-default text-foreground">
                                    <ConnectionMark connection={connection} />
                                </Modal.Icon>
                                <Modal.Heading>
                                    {connection.name}
                                    <Chip
                                        className="ms-2 align-middle"
                                        color={connection.connected ? 'success' : 'default'}
                                        size="sm"
                                        variant="soft"
                                    >
                                        {connection.connected ? 'Connected' : 'Not connected'}
                                    </Chip>
                                </Modal.Heading>
                                {/* What the server is, when it says so. Its
                                    address is diagnostic, so it only stands in
                                    when there is nothing better. */}
                                {connection.summary ? (
                                    <p className="mt-1.5 text-muted text-sm leading-5">
                                        {connection.summary}
                                    </p>
                                ) : (
                                    <p className="mt-1.5 truncate font-mono text-muted text-sm">
                                        {connectionSummary(connection)}
                                    </p>
                                )}
                            </Modal.Header>
                            <Modal.Body>
                                <div className="grid gap-6">
                                    <ItemCardGroup variant="transparent">
                                        <ItemCardGroup.Header className="flex items-center justify-between gap-3">
                                            <ItemCardGroup.Title>
                                                Tools
                                                {tools && tools.length > 0 ? (
                                                    <span className="ms-2 text-muted tabular-nums">
                                                        {tools.length}
                                                    </span>
                                                ) : null}
                                            </ItemCardGroup.Title>
                                            {toolsPending ? (
                                                <Spinner size="sm" />
                                            ) : (
                                                <Tooltip delay={0}>
                                                    <Button
                                                        aria-label="Refresh tools"
                                                        isDisabled={!connection.connected}
                                                        isIconOnly
                                                        onPress={() => {
                                                            void onRefresh(connection).catch(
                                                                () => undefined
                                                            );
                                                        }}
                                                        size="sm"
                                                        variant="ghost"
                                                    >
                                                        <Icon
                                                            icon={ArrowReloadHorizontalIcon}
                                                            size={16}
                                                        />
                                                    </Button>
                                                    <Tooltip.Content>Refresh tools</Tooltip.Content>
                                                </Tooltip>
                                            )}
                                        </ItemCardGroup.Header>
                                        {/* Bounded: a server with thirty tools
                                            would otherwise bury Agent Access and
                                            Manage under a wall of rows. */}
                                        <ItemCardGroup
                                            className="max-h-72 overflow-y-auto"
                                            variant="secondary"
                                        >
                                            <ToolList
                                                connection={connection}
                                                error={toolsError}
                                                pending={toolsPending}
                                                tools={tools}
                                            />
                                        </ItemCardGroup>
                                    </ItemCardGroup>

                                    <ItemCardGroup variant="transparent">
                                        <ItemCardGroup.Header>
                                            <ItemCardGroup.Title>Agent Access</ItemCardGroup.Title>
                                        </ItemCardGroup.Header>
                                        <ItemCardGroup
                                            className="max-h-72 overflow-y-auto"
                                            variant="secondary"
                                        >
                                            {connection.affectedAgents.length > 0 ? (
                                                connection.affectedAgents.map((agent, index) => (
                                                    <Fragment key={agent.id}>
                                                        {index > 0 ? (
                                                            <Separator variant="secondary" />
                                                        ) : null}
                                                        <ItemCard>
                                                            <ItemCard.Content>
                                                                <ItemCard.Title>
                                                                    {agent.name}
                                                                </ItemCard.Title>
                                                            </ItemCard.Content>
                                                        </ItemCard>
                                                    </Fragment>
                                                ))
                                            ) : (
                                                <p className="px-4 py-4 text-muted text-sm">
                                                    No agents have access yet.
                                                </p>
                                            )}
                                        </ItemCardGroup>
                                    </ItemCardGroup>

                                    {/* Named rows, the way Computer Management
                                        does it. An overflow menu in a dialog
                                        corner hides these behind a guess. */}
                                    <ItemCardGroup variant="transparent">
                                        <ItemCardGroup.Header>
                                            <ItemCardGroup.Title>Manage</ItemCardGroup.Title>
                                        </ItemCardGroup.Header>
                                        <ItemCardGroup
                                            className="overflow-hidden"
                                            variant="secondary"
                                        >
                                            {connection.preset ? (
                                                <ManageRow title="Add another account">
                                                    <Button
                                                        isDisabled={saving}
                                                        onPress={() => onAddAccount(connection)}
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Add
                                                    </Button>
                                                </ManageRow>
                                            ) : null}
                                            {/* Nothing to sign out of when the
                                                server takes no credentials. */}
                                            {connection.connected && connection.auth !== 'none' ? (
                                                <ManageRow
                                                    description="Signs out and revokes every Agent's access. The connection stays, so you can reconnect."
                                                    title="Disconnect account"
                                                >
                                                    <Button
                                                        onPress={() =>
                                                            setDestructiveAction('disconnect')
                                                        }
                                                        size="sm"
                                                        variant="danger-soft"
                                                    >
                                                        Disconnect
                                                    </Button>
                                                </ManageRow>
                                            ) : null}
                                            {connection.builtIn ? null : (
                                                <ManageRow
                                                    description="Removes this connection and every Agent's access to it."
                                                    title="Delete connection"
                                                >
                                                    <Button
                                                        onPress={() =>
                                                            setDestructiveAction('delete')
                                                        }
                                                        size="sm"
                                                        variant="danger-soft"
                                                    >
                                                        Delete
                                                    </Button>
                                                </ManageRow>
                                            )}
                                        </ItemCardGroup>
                                    </ItemCardGroup>
                                </div>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button slot="close" variant="secondary">
                                    Done
                                </Button>
                                {connection.auth === 'oauth' ? (
                                    <Button
                                        isDisabled={saving}
                                        isPending={startingOAuthId === connection.id}
                                        onPress={() => onStartOAuth(connection)}
                                    >
                                        {connection.connected ? 'Reconnect' : 'Connect'}
                                    </Button>
                                ) : null}
                                {connection.auth === 'headers' ? (
                                    <Button
                                        isDisabled={saving}
                                        onPress={() => setEditingHeaders(true)}
                                    >
                                        {connection.connected ? 'Replace credentials' : 'Connect'}
                                    </Button>
                                ) : null}
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
            <ItemCard>
                <ItemCard.Content>
                    <ItemCard.Title>{tool.title ?? tool.name}</ItemCard.Title>
                    {tool.description ? (
                        <ItemCard.Description>{tool.description}</ItemCard.Description>
                    ) : null}
                </ItemCard.Content>
            </ItemCard>
        </Fragment>
    ));
}

function ConnectionMark({ connection }: { connection: McpConnection }) {
    const icon = connectionIcon(connection, useResolvedThemeOptional());

    if (icon.kind === 'image') {
        return (
            <img
                alt=""
                className="size-full rounded-[inherit] object-cover"
                height={32}
                src={icon.src}
                width={32}
            />
        );
    }
    return <span style={{ color: `var(${icon.colorVar})` }}>{icon.letter}</span>;
}

function ManageRow({
    children,
    description,
    title,
}: {
    children: ReactNode;
    description?: string;
    title: string;
}) {
    return (
        <ItemCard>
            <ItemCard.Content>
                <ItemCard.Title>{title}</ItemCard.Title>
                {/* Only where the title alone leaves the outcome ambiguous. */}
                {description ? (
                    <ItemCard.Description className="whitespace-normal">
                        {description}
                    </ItemCard.Description>
                ) : null}
            </ItemCard.Content>
            <ItemCard.Action>{children}</ItemCard.Action>
        </ItemCard>
    );
}
