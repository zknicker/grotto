import { View } from 'react-native';

import type { AgentAvailability } from './types';

export function AvatarStatusBadge({
    availability,
    avatarSize,
}: {
    availability: AgentAvailability;
    avatarSize: number;
}) {
    const size = Math.min(14, Math.max(10, Math.round(avatarSize * 0.5)));

    return (
        <View
            accessibilityElementsHidden
            className={`absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-background ${availabilityColor(availability)}`}
            pointerEvents="none"
            style={{ height: size, width: size }}
        />
    );
}

export function getAvailabilityLabel(availability: AgentAvailability): string {
    switch (availability) {
        case 'idle':
            return 'Online';
        case 'working':
            return 'Working';
        case 'error':
            return 'Needs attention';
        case 'offline':
            return 'Offline';
        case 'stopped':
            return 'Stopped';
    }
}

function availabilityColor(availability: AgentAvailability): string {
    switch (availability) {
        case 'idle':
            return 'bg-success';
        case 'working':
            return 'bg-warning';
        case 'error':
            return 'bg-danger';
        default:
            return 'bg-muted';
    }
}
