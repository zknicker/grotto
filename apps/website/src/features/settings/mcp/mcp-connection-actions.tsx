import { AlertDialog, Button } from '@heroui/react';
import type { McpConnection } from './mcp-server-shared.ts';

export type McpDestructiveAction = 'delete' | 'disconnect' | 'replace-credentials';

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
            <AlertDialog.Backdrop isDismissable>
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
                            <Button onPress={onConfirm} slot="close" variant="danger">
                                {label}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}
