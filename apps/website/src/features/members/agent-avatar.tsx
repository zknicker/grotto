import type { HostedAgent } from '@tavern/api';
import type React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { useOptionalCurrentAgentActivity } from '../../hooks/agents/use-current-agent-activity.tsx';
import { cn } from '../../lib/utils.ts';

/** Hosted availability mapped onto the stock Badge colour vocabulary. */
export function hostedAvailabilityBadgeColor(availability: HostedAgent['availability']) {
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

/** Hosted availability mapped onto the shared status-dot vocabulary. */
export function hostedAvailabilityStatus(availability: HostedAgent['availability'] | undefined) {
    switch (availability) {
        case 'idle':
            return 'success' as const;
        case 'working':
            return 'warning' as const;
        case 'error':
            return 'error' as const;
        default:
            return 'muted' as const;
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
        <span
            className={cn('relative flex shrink-0 items-center justify-center', className)}
            data-agent-id={agent.id}
            data-agent-status={availability ?? 'unknown'}
            style={{ height: size, width: size }}
        >
            <EntityAvatar name={agent.displayName} size={size} src={agent.avatarUrl} />
            <StatusDot
                className="absolute -right-0.5 -bottom-0.5 ring-2 ring-background"
                size="md"
                status={hostedAvailabilityStatus(availability)}
                title={hostedAvailabilityLabel(availability) ?? undefined}
            />
        </span>
    );
}
