import { Button } from '@heroui/react';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { HostedDeleteDialog } from '../../../routes/app/hosted-delete-dialog.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';

export function HostedAgentDangerSection({
    agent,
    onDeleted,
    server,
}: {
    agent: HostedAgent;
    onDeleted: () => void;
    server: ServerDetail;
}) {
    const utils = grottoTrpc.useUtils();
    const [deleting, setDeleting] = React.useState(false);
    const remove = grottoTrpc.agent.delete.useMutation({
        onSuccess: async () => {
            setDeleting(false);
            await Promise.all([
                utils.agent.list.invalidate({ serverId: server.id }),
                utils.chat.list.invalidate({ serverId: server.id }),
                utils.computer.list.invalidate({ serverId: server.id }),
            ]);
            onDeleted();
        },
    });

    if (server.role !== 'owner' && server.role !== 'admin') {
        return null;
    }

    return (
        <SettingsSection title="Danger">
            <SettingsGroup>
                <SettingsRow
                    description="Remove this Agent. Its collaboration history remains."
                    title="Delete Agent"
                    trailingWidth="intrinsic"
                >
                    <Button
                        onPress={() => setDeleting(true)}
                        size="sm"
                        type="button"
                        variant="danger-soft"
                    >
                        Delete Agent
                    </Button>
                </SettingsRow>
            </SettingsGroup>
            {deleting ? (
                <HostedDeleteDialog
                    confirmation={agent.displayName}
                    description="This permanently destroys the Agent’s local workspace, skills, runtime state, queues, and vault when its Computer can be reached. Its authored collaboration history remains."
                    onConfirm={() =>
                        remove.mutate({
                            agentId: agent.id,
                            confirmation: agent.displayName,
                            serverId: server.id,
                        })
                    }
                    onOpenChange={(open) => !open && setDeleting(false)}
                    pending={remove.isPending}
                    title="Delete Agent"
                />
            ) : null}
        </SettingsSection>
    );
}
