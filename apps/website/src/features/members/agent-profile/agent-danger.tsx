import { Button } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import type { Agent } from '@tavern/api';
import * as React from 'react';
import { useAgentDelete } from '../../../hooks/members/use-agent-delete.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { DeleteDialog } from '../../../routes/app/delete-dialog.tsx';
import { SettingsSection } from '../../settings/layout/settings-page.tsx';

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
            <ItemCardGroup className="overflow-hidden">
                <ItemCard>
                    <ItemCard.Content>
                        <ItemCard.Title>Delete Agent</ItemCard.Title>
                        <ItemCard.Description>
                            Remove this Agent. Its collaboration history remains.
                        </ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action>
                        <Button
                            onPress={() => setDeleting(true)}
                            size="sm"
                            type="button"
                            variant="danger-soft"
                        >
                            Delete Agent
                        </Button>
                    </ItemCard.Action>
                </ItemCard>
            </ItemCardGroup>
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
