import type { Agent, PreparedAction } from '@grotto/api';
import { isAgentCreatePreparedAction } from '@grotto/api/prepared-actions';
import { AlertCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { ActionCard, ActionCardGlyphMark } from '../../components/chats/action-card.tsx';
import { AgentCreateActionCard } from './agent-create-action-card.tsx';

/** Empty superseded cards leave a receipt; authored message content always wins. */
export function preparedActionMessageText(message: {
    content: string;
    preparedAction?: PreparedAction;
}): string {
    if (message.content.trim() || !message.preparedAction) {
        return message.content;
    }

    if (!isAgentCreatePreparedAction(message.preparedAction)) {
        return '';
    }

    return message.preparedAction.status === 'superseded' ? 'Earlier proposal, replaced.' : '';
}

export function PreparedActionCard({
    action,
    agents = [],
    canManage = false,
    executedByDisplayName,
    serverId,
}: {
    action: PreparedAction;
    agents?: readonly Agent[];
    canManage?: boolean;
    executedByDisplayName?: string;
    serverId?: string;
}) {
    if (isAgentCreatePreparedAction(action)) {
        return (
            <AgentCreateActionCard
                action={action}
                agents={agents}
                canManage={canManage}
                executedByDisplayName={executedByDisplayName}
                serverId={serverId}
            />
        );
    }

    // A kind this release cannot render stays inert and out of the way: no
    // status to report, and nothing to press.
    return (
        <ActionCard
            actionKind={action.kind}
            actionStatus={action.status}
            aria-label={`Unsupported action ${action.kind}`}
        >
            <ActionCard.Header>
                <ActionCard.Mark>
                    <ActionCardGlyphMark icon={AlertCircleIcon} />
                </ActionCard.Mark>
                <ActionCard.Content>
                    <ActionCard.Title>{action.kind}</ActionCard.Title>
                    <ActionCard.Description>
                        Unsupported action · Not available in this version of Grotto
                    </ActionCard.Description>
                </ActionCard.Content>
            </ActionCard.Header>
        </ActionCard>
    );
}
