import type { Agent, AgentAvailability } from '@grotto/api';
import { Badge } from '@heroui/react';
import type React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { cn } from '../../lib/utils.ts';

/** Agent availability mapped onto the stock Badge color vocabulary. */
export function availabilityBadgeColor(availability: AgentAvailability) {
    switch (availability) {
        case 'idle':
            return 'success' as const;
        case 'working':
            return 'warning' as const;
        case 'error':
            return 'danger' as const;
        case 'offline':
        case 'stopped':
            return 'default' as const;
    }
}

export function availabilityLabel(availability: AgentAvailability) {
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
        availability: AgentAvailability;
        avatarUrl: Agent['avatarUrl'];
        displayName: Agent['displayName'];
        id: Agent['id'];
    };
    className?: string;
    size?: number;
}): React.ReactElement {
    const availability = agent.availability;

    return (
        <Badge.Anchor
            className={className}
            data-agent-id={agent.id}
            data-agent-status={availability}
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
                title={availabilityLabel(availability)}
            />
        </Badge.Anchor>
    );
}
