import { Badge } from '@heroui/react';
import type { Agent } from '@tavern/api';
import type React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { cn } from '../../lib/utils.ts';

/**  availability mapped onto the stock Badge colour vocabulary. */
export function availabilityBadgeColor(availability: Agent['availability'] | undefined) {
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

export function availabilityLabel(availability: Agent['availability'] | undefined) {
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
        availability?: Agent['availability'];
        avatarUrl: Agent['avatarUrl'];
        displayName: Agent['displayName'];
        id?: Agent['id'];
    };
    className?: string;
    size?: number;
}): React.ReactElement {
    const availability = agent.availability;

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
                color={availabilityBadgeColor(availability)}
                placement="bottom-right"
                size="sm"
                title={availabilityLabel(availability) ?? undefined}
            />
        </Badge.Anchor>
    );
}
