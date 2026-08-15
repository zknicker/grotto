import { Card, Skeleton } from '@heroui/react';
import type { Agent } from '@tavern/api';
import { useUsage } from '../../hooks/servers/use-usage.ts';
import { AgentTokenUsage } from '../stats/token-usage-module.tsx';

export function AgentUsageOverview({ agent, serverId }: { agent: Agent; serverId: string }) {
    const usage = useUsage(serverId);

    if (usage.data?.tokenUsage) {
        return (
            <AgentTokenUsage
                agent={{
                    agentAvatarUrl: agent.avatarUrl,
                    agentHandle: agent.handle,
                    agentId: agent.id,
                    agentName: agent.displayName,
                }}
                usage={usage.data.tokenUsage}
            />
        );
    }
    if (usage.error) {
        return (
            <Card>
                <Card.Content>
                    <p className="font-medium text-base">Usage unavailable</p>
                    <p className="mt-1 text-muted text-sm">{usage.error.message}</p>
                </Card.Content>
            </Card>
        );
    }
    if (usage.data) {
        return (
            <Card>
                <Card.Content>
                    <p className="font-medium text-base">No usage yet</p>
                    <p className="mt-1 text-muted text-sm">
                        Usage will appear after this Agent completes a model turn.
                    </p>
                </Card.Content>
            </Card>
        );
    }
    return <Skeleton aria-label="Loading Agent usage" className="h-80 w-full rounded-2xl" />;
}
