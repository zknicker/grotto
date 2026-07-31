import { AlertDialog, Button, Dropdown, Label, Separator } from '@heroui/react';
import {
    ArrowReloadHorizontalIcon,
    Delete02Icon,
    MoreHorizontalIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import type { McpConnection } from './mcp-server-shared.ts';

export type McpDestructiveAction = 'delete' | 'disconnect' | 'replace-credentials';

export function ConnectionMenu({
    connection,
    disabled,
    onAddAccount,
    onDelete,
    onDisconnect,
    onRefresh,
}: {
    connection: McpConnection;
    disabled: boolean;
    onAddAccount: () => void;
    onDelete: () => void;
    onDisconnect: () => void;
    onRefresh: () => void;
}) {
    return (
        <Dropdown>
            <Button aria-label={`${connection.name} actions`} size="sm" variant="ghost">
                <Icon className="size-4" icon={MoreHorizontalIcon} />
                Actions
            </Button>
            <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                    onAction={(key) => {
                        if (key === 'refresh') {
                            onRefresh();
                        } else if (key === 'add-account') {
                            onAddAccount();
                        } else if (key === 'disconnect') {
                            onDisconnect();
                        } else if (key === 'delete') {
                            onDelete();
                        }
                    }}
                >
                    <Dropdown.Item
                        id="refresh"
                        isDisabled={!connection.connected}
                        textValue="Refresh Tools"
                    >
                        <Icon icon={ArrowReloadHorizontalIcon} />
                        <Label>Refresh Tools</Label>
                    </Dropdown.Item>
                    {connection.preset ? (
                        <Dropdown.Item
                            id="add-account"
                            isDisabled={disabled}
                            textValue="Add Another Account"
                        >
                            <Label>Add Another Account</Label>
                        </Dropdown.Item>
                    ) : null}
                    {connection.connected && connection.auth !== 'none' ? (
                        <>
                            <Separator />
                            <Dropdown.Item
                                id="disconnect"
                                isDisabled={disabled}
                                textValue="Disconnect"
                            >
                                <Label>Disconnect</Label>
                            </Dropdown.Item>
                        </>
                    ) : null}
                    {connection.builtIn ? null : (
                        <Dropdown.Item
                            id="delete"
                            isDisabled={disabled}
                            textValue="Delete Connection"
                            variant="danger"
                        >
                            <Icon icon={Delete02Icon} />
                            <Label>Delete Connection</Label>
                        </Dropdown.Item>
                    )}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}

export function ConnectionDestructiveDialog({
    action,
    connection,
    onConfirm,
    onOpenChange,
}: {
    action: McpDestructiveAction | null;
    connection: McpConnection;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
}) {
    const label =
        action === 'delete'
            ? 'Delete'
            : action === 'replace-credentials'
              ? 'Replace Credentials'
              : 'Disconnect';
    return (
        <AlertDialog isOpen={action !== null} onOpenChange={onOpenChange}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="danger" />
                            <AlertDialog.Heading>
                                {label} {connection.name}?
                            </AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            {connection.affectedAgents.length === 0
                                ? 'No Agents currently use this connection.'
                                : `${connection.affectedAgents.map((agent) => agent.name).join(', ')} will lose access to this MCP server.`}
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button onPress={onConfirm} slot="close" variant="danger-soft">
                                {label}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}
