import type { Agent } from '@grotto/api';
import { ItemCard } from '@heroui-pro/react';
import { useAgentActivityPreview } from '../../../hooks/members/use-agent-activity-preview.ts';
import { formatShortTime } from '../../../lib/format.ts';
import { formatAgentActivityEvent } from '../agent-profile/agent-activity-model.ts';
import { agentPeekActivityTitle } from './agent-peek-model.ts';
import { PeekPressableCard, PeekSection } from './peek-section.tsx';

/**
 * The last thing this Agent did, and what it is doing when a turn is still
 * running. Availability is the header's chip and appears nowhere else, so this
 * section is the activity line alone; the same subscription the hover card uses
 * keeps it current.
 */
export function AgentPeekNow({
    agent,
    onOpenActivity,
    serverId,
}: {
    agent: Agent;
    onOpenActivity: () => void;
    serverId: string;
}) {
    const activity = useAgentActivityPreview(serverId, agent.id);
    const latest = activity.data?.events.at(0) ?? null;

    return (
        <PeekSection title={agentPeekActivityTitle(latest)}>
            {/* Blank until the read settles; "No recent activity" is reserved
                for an Agent that genuinely has none. */}
            {activity.isPending ? null : (
                <PeekPressableCard label="Open this Agent's activity" onPress={onOpenActivity}>
                    <ItemCard.Content>
                        {latest ? (
                            <>
                                <ItemCard.Title>{formatAgentActivityEvent(latest)}</ItemCard.Title>
                                <ItemCard.Description className="tabular-nums">
                                    {formatShortTime(latest.occurredAt)}
                                </ItemCard.Description>
                            </>
                        ) : (
                            <ItemCard.Description>No recent activity</ItemCard.Description>
                        )}
                    </ItemCard.Content>
                </PeekPressableCard>
            )}
        </PeekSection>
    );
}
