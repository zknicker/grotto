import type { Agent, AgentCreatePreparedAction } from '@grotto/api';
import * as React from 'react';
import { usePreparedActionCommit } from '../../hooks/servers/use-prepared-action-commit.ts';
import { AgentCreationDialog } from '../members/agent-creation-dialog.tsx';
import type { AgentCreationSubmitValues } from '../members/agent-creation-form.tsx';

export function PreparedAgentCreateDialog({
    action,
    agents,
    onCommitted,
    onOpenChange,
    open,
    serverId,
}: {
    action: AgentCreatePreparedAction;
    agents: readonly Agent[];
    onCommitted: (agentId: string) => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    serverId: string;
}) {
    const commit = usePreparedActionCommit(serverId);
    const initialValues = React.useMemo(
        () => ({
            avatarUrl: action.proposal.avatar.url,
            computerId: action.proposal.computer?.computerId,
            description: action.proposal.description,
            displayName: action.proposal.name,
        }),
        [action.proposal]
    );

    const submit = React.useCallback(
        async (values: AgentCreationSubmitValues) => {
            const result = await commit.commit({
                ...values,
                actionId: action.id,
                serverId,
            });
            return { agentId: result.agent.id };
        },
        [action.id, commit.commit, serverId]
    );

    return (
        <AgentCreationDialog
            agents={agents}
            error={commit.error}
            initialValues={initialValues}
            isPending={commit.isPending}
            onCreated={onCommitted}
            onOpenChange={onOpenChange}
            onSubmit={submit}
            open={open}
            serverId={serverId}
        />
    );
}
