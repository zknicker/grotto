import type { HostedAgent, HostedMcpConnection, HostedMcpPreset } from '@tavern/api';
import {
    AlertDialog,
    AlertDialogClose,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogPopup,
    AlertDialogTitle,
} from '../../components/ui/alert-dialog.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import type { McpConnection } from '../../features/settings/mcp/mcp-server-shared.ts';

export function HostedMcpPresetButtons({
    onAdd,
}: {
    onAdd(preset: HostedMcpPreset, name: string): void;
}) {
    return (
        <div className="flex gap-2">
            <Button
                onClick={() => onAdd('google-calendar', 'Google Calendar')}
                type="button"
                variant="secondary"
            >
                Add Google Calendar
            </Button>
            <Button
                onClick={() => onAdd('merchbase', 'MerchBase')}
                type="button"
                variant="secondary"
            >
                Add MerchBase
            </Button>
        </div>
    );
}

export function HostedMcpTrustDialog({
    onClose,
    onConfirm,
    request,
}: {
    onClose(): void;
    onConfirm(): void;
    request: { connection: McpConnection; origin: string } | null;
}) {
    return (
        <AlertDialog onOpenChange={(open) => !open && onClose()} open={request !== null}>
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

export function toHostedMcpView(
    connection: HostedMcpConnection,
    agents: HostedAgent[] = []
): McpConnection {
    const grantedAgentIds = new Set(connection.grants.map((grant) => grant.agentId));
    return {
        accountLabel: connection.accountLabel,
        affectedAgents: agents
            .filter((agent) => grantedAgentIds.has(agent.id))
            .map((agent) => ({ id: agent.id, name: agent.displayName })),
        auth: connection.auth,
        builtIn: connection.preset !== null,
        connected: connection.connected,
        headerNames: connection.headerNames,
        id: connection.id,
        name: connection.name,
        preset: connection.preset,
        url: connection.url,
    };
}
