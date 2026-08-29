import type { Agent } from '@grotto/api';
import { Skeleton } from '@heroui/react';
import { useUsage } from '../../hooks/servers/use-usage.ts';
import { AgentTokenUsage } from '../stats/token-usage-module.tsx';
import { UsageEmptyCard } from './usage-empty.tsx';

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
        return <UsageEmptyCard description={usage.error.message} title="Usage Unavailable" />;
    }
    if (usage.data) {
        return (
            <UsageEmptyCard
                description="Usage will appear after this Agent completes a model turn."
                title="No Usage Yet"
            />
        );
    }
    return <Skeleton aria-label="Loading Agent usage" className="h-80 w-full rounded-2xl" />;
}
