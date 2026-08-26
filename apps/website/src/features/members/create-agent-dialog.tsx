import type { Agent } from '@grotto/api';
import * as React from 'react';
import { useAgentCreate } from '../../hooks/members/use-agent-create.ts';
import { AgentCreationDialog } from './agent-creation-dialog.tsx';
import type { AgentCreationSubmitValues } from './agent-creation-form.tsx';

interface CreateAgentDialogProps {
    agents: Agent[];
    onCreated: (agentId: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    serverId: string;
}

export function CreateAgentDialog({
    agents,
    onCreated,
    onOpenChange,
    open,
    serverId,
}: CreateAgentDialogProps) {
    const create = useAgentCreate(serverId);

    const submit = React.useCallback(
        async (values: AgentCreationSubmitValues) => {
            const result = await create.createAgent({
                ...values,
                role: 'member',
                serverId,
            });
            return { agentId: result.agent.id };
        },
        [create.createAgent, serverId]
    );

    return (
        <AgentCreationDialog
            agents={agents}
            error={create.error}
            isPending={create.isPending}
            onCreated={onCreated}
            onOpenChange={onOpenChange}
            onSubmit={submit}
            open={open}
            serverId={serverId}
        />
    );
}
