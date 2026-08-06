import { AlertDialog, Button } from '@heroui/react';
import type { HostedAgent, HostedMcpConnection, HostedMcpPreset } from '@tavern/api';
import type { McpConnection } from './mcp-server-shared.ts';

export function ConnectionPresetButtons({
    onAdd,
}: {
    onAdd(preset: HostedMcpPreset, name: string): void;
}) {
    return (
        <div className="flex gap-2">
            <Button
                onPress={() => onAdd('google-calendar', 'Google Calendar')}
                type="button"
                variant="secondary"
            >
                Google Calendar
            </Button>
            <Button
                onPress={() => onAdd('merchbase', 'MerchBase')}
                type="button"
                variant="secondary"
            >
                MerchBase
            </Button>
        </div>
    );
}

export function ConnectionTrustDialog({
    onClose,
    onConfirm,
    request,
}: {
    onClose(): void;
    onConfirm(): void;
    request: { connection: McpConnection; origin: string } | null;
}) {
    return (
        <AlertDialog isOpen={request !== null} onOpenChange={(open) => !open && onClose()}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container size="sm">
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Icon status="warning" />
                            <AlertDialog.Heading>Trust This Sign-In Service?</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            {request?.connection.name} uses{' '}
                            <span className="font-mono">{request?.origin}</span> for sign-in.
                            Continue only if you recognize this service.
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button slot="close" variant="secondary">
                                Cancel
                            </Button>
                            <Button onPress={onConfirm} slot="close">
                                Trust and Continue
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}

export function toConnectionView(
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
