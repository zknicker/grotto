import type { HostedAgent } from '@tavern/api';
import type React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';

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
export function hostedAvailabilityStatus(availability: HostedAgent['availability']) {
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

/**
 * Rail avatar with the agent's presence dot pinned to its corner. The dot is
 * outset past the corner and ringed in `--presence-ring`, an opaque stand-in
 * for the surface behind it, so it separates from the avatar instead of
 * sitting on top of it. Surfaces that paint their own fill rescope that
 * variable rather than the dot restyling itself per context.
 */
export function HostedAgentRailAvatar({
    agent,
    size = 20,
}: {
    agent: Pick<HostedAgent, 'availability' | 'avatarUrl' | 'displayName'>;
    size?: number;
}): React.ReactElement {
    return (
        <span
            className="relative flex shrink-0 items-center justify-center"
            style={{ height: size, width: size }}
        >
            <EntityAvatar name={agent.displayName} size={size} src={agent.avatarUrl} />
            <StatusDot
                className="absolute -right-0.5 -bottom-0.5 ring-2 ring-[var(--presence-ring)]"
                size="md"
                status={hostedAvailabilityStatus(agent.availability)}
                title={agent.availability}
            />
        </span>
    );
}
