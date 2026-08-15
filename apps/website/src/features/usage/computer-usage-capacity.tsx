import { Card } from '@heroui/react';
import type { ComputerRuntimeId, ComputerUsage } from '@tavern/api';
import { useNavigate } from 'react-router-dom';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useUsage } from '../../hooks/servers/use-usage.ts';
import { membersUsageRoute } from '../servers/server-routes.ts';
import { DetectedRuntimeUsage, DetectedRuntimeUsageSkeleton } from './detected-runtime-usage.tsx';

export function ComputerUsageCapacity({
    computerId,
    detectedRuntimeIds,
    serverId,
    serverSlug,
}: {
    computerId: string;
    detectedRuntimeIds: ComputerRuntimeId[];
    serverId: string;
    serverSlug: string;
}) {
    const navigate = useNavigate();
    const usage = useUsage(serverId);
    const agents = useAgents(serverId);
    const computer = usage.data?.computers.find((item) => item.computerId === computerId);
    const piAgentCount = agents.data
        ? agents.data.filter(
              (agent) => agent.computerId === computerId && agent.desiredRuntimeId === 'pi'
          ).length
        : null;

    return (
        <ComputerUsageCapacityView
            computer={computer}
            detectedRuntimeIds={detectedRuntimeIds}
            error={usage.data ? undefined : usage.error?.message}
            isPending={!usage.data && usage.isPending}
            onViewPiUsage={() =>
                navigate(membersUsageRoute(serverSlug, { computerId, runtimeId: 'pi' }))
            }
            piAgentCount={piAgentCount}
        />
    );
}

export function ComputerUsageCapacityView({
    computer,
    detectedRuntimeIds,
    error,
    isPending = false,
    piAgentCount = null,
    onViewPiUsage,
}: {
    computer: ComputerUsage | undefined;
    detectedRuntimeIds: ComputerRuntimeId[];
    error?: string;
    isPending?: boolean;
    piAgentCount?: number | null;
    onViewPiUsage?: () => void;
}) {
    if (isPending) {
        return <DetectedRuntimeUsageSkeleton detectedRuntimeIds={detectedRuntimeIds} />;
    }
    if (error) {
        return <CapacityMessage description={error} title="Usage unavailable" />;
    }
    if (!computer?.usage) {
        return (
            <CapacityMessage
                description={
                    computer?.health === 'healthy'
                        ? 'This Computer has not completed its first usage report.'
                        : 'Reconnect this Computer to collect a usage report.'
                }
                title={computer?.health === 'healthy' ? 'Collecting usage' : 'Usage not reported'}
            />
        );
    }

    return (
        <DetectedRuntimeUsage
            detectedRuntimeIds={detectedRuntimeIds}
            onViewPiUsage={onViewPiUsage}
            piAgentCount={piAgentCount}
            usage={computer.usage}
        />
    );
}

function CapacityMessage({ description, title }: { description: string; title: string }) {
    return (
        <Card>
            <Card.Content>
                <p className="font-medium text-base">{title}</p>
                <p className="mt-1 text-muted text-sm">{description}</p>
            </Card.Content>
        </Card>
    );
}
