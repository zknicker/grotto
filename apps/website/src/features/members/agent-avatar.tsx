import { Badge } from '@heroui/react';
import type { HostedAgent } from '@tavern/api';
import type React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { useOptionalCurrentAgentActivity } from '../../hooks/agents/use-current-agent-activity.tsx';
import { cn } from '../../lib/utils.ts';

/** Hosted availability mapped onto the stock Badge colour vocabulary. */
export function hostedAvailabilityBadgeColor(
    availability: HostedAgent['availability'] | undefined
) {
    switch (availability) {
        case 'idle':
            return 'success' as const;
        case 'working':
            return 'warning' as const;
        case 'error':
            return 'danger' as const;
        default:
            return 'default' as const;
    }
}

export function hostedAvailabilityLabel(availability: HostedAgent['availability'] | undefined) {
    switch (availability) {
        case 'idle':
            return 'Online';
        case 'working':
            return 'Working';
        case 'offline':
            return 'Offline';
        case 'stopped':
            return 'Stopped';
        case 'error':
            return 'Needs attention';
        default:
            return null;
    }
}

export function resolveAgentAvatarAvailability(
    availability: HostedAgent['availability'] | undefined,
    isCurrentlyWorking: boolean | undefined
) {
    if (isCurrentlyWorking === true) {
        return 'working' as const;
    }
    if (isCurrentlyWorking === false && availability === 'working') {
        return 'idle' as const;
    }
    return availability;
}

/**
 * Rail avatar with the agent's presence dot pinned to its corner. The dot is
 * outset past the corner and ringed in the page background so it separates
 * from the avatar instead of sitting on top of it.
 */
export function AgentAvatar({
    agent,
    className,
    size = 20,
}: {
    agent: {
        availability?: HostedAgent['availability'];
        avatarUrl: HostedAgent['avatarUrl'];
        displayName: HostedAgent['displayName'];
        id?: HostedAgent['id'];
    };
    className?: string;
    size?: number;
}): React.ReactElement {
    const currentActivity = useOptionalCurrentAgentActivity();
    const availability = resolveAgentAvatarAvailability(
        agent.availability,
        agent.id && currentActivity?.isSnapshotReady
            ? currentActivity.activityByAgentId.has(agent.id)
            : undefined
    );

    return (
        <Badge.Anchor
            className={className}
            data-agent-id={agent.id}
            data-agent-status={availability ?? 'unknown'}
            style={{ height: size, width: size }}
        >
            <EntityAvatar name={agent.displayName} size={size} src={agent.avatarUrl} />
            <Badge
                className={cn(
                    availability !== 'idle' &&
                        availability !== 'working' &&
                        availability !== 'error' &&
                        'bg-muted'
                )}
                color={hostedAvailabilityBadgeColor(availability)}
                placement="bottom-right"
                size="sm"
                title={hostedAvailabilityLabel(availability) ?? undefined}
            />
        </Badge.Anchor>
    );
}
