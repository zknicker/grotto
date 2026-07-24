import {
    ArrowReloadHorizontalIcon,
    Delete02Icon,
    MoreHorizontalIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import {
    AlertDialog,
    AlertDialogClose,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogPopup,
    AlertDialogTitle,
} from '../../../components/ui/alert-dialog.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    Menu,
    MenuItem,
    MenuPopup,
    MenuSeparator,
    MenuTrigger,
} from '../../../components/ui/menu.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
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
        <Menu>
            <MenuTrigger
                render={
                    <Button
                        aria-label={`${connection.name} actions`}
                        size="icon-sm"
                        variant="ghost"
                    />
                }
            >
                <Icon className="size-4" icon={MoreHorizontalIcon} />
            </MenuTrigger>
            <MenuPopup align="end">
                <MenuItem disabled={!connection.connected} onClick={onRefresh}>
                    <Icon icon={ArrowReloadHorizontalIcon} />
                    Refresh tools
                </MenuItem>
                {connection.preset ? (
                    <MenuItem disabled={disabled} onClick={onAddAccount}>
                        Add another account
                    </MenuItem>
                ) : null}
                {connection.connected && connection.auth !== 'none' ? (
                    <>
                        <MenuSeparator />
                        <MenuItem disabled={disabled} onClick={onDisconnect}>
                            Disconnect
                        </MenuItem>
                    </>
                ) : null}
                {connection.builtIn ? null : (
                    <MenuItem disabled={disabled} onClick={onDelete} variant="destructive">
                        <Icon icon={Delete02Icon} />
                        Delete connection
                    </MenuItem>
                )}
            </MenuPopup>
        </Menu>
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
              ? 'Replace credentials'
              : 'Disconnect';
    return (
        <AlertDialog onOpenChange={onOpenChange} open={action !== null}>
            <AlertDialogPopup>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {label} {connection.name}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {connection.affectedAgents.length === 0
                            ? 'This connection has no agent tool grants.'
                            : `${connection.affectedAgents.map((agent) => agent.name).join(', ')} will lose access to this connection and its current tool grants.`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
                    <AlertDialogClose onClick={onConfirm} render={<Button variant="destructive" />}>
                        {label}
                    </AlertDialogClose>
                </AlertDialogFooter>
            </AlertDialogPopup>
        </AlertDialog>
    );
}
