import { Button } from '@heroui/react';
import type { Agent } from '@tavern/api';
import * as React from 'react';
import { useAgentDelete } from '../../../hooks/members/use-agent-delete.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { DeleteDialog } from '../../../routes/app/delete-dialog.tsx';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';

export function AgentDanger({
    agent,
    onDeleted,
    server,
}: {
    agent: Agent;
    onDeleted: () => void;
    server: ServerDetail;
}) {
    const [deleting, setDeleting] = React.useState(false);
    const remove = useAgentDelete(server.id, () => {
        setDeleting(false);
        onDeleted();
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
                <DeleteDialog
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
