import { View } from 'react-native';

import { AvatarStatusBadge, getAvailabilityLabel } from './avatar-status-badge';
import { EntityAvatar } from './entity-avatar';
import type { AgentSummary } from './types';

export function AgentAvatar({ agent, size = 24 }: { agent: AgentSummary; size?: number }) {
    return (
        <View
            accessibilityLabel={`${agent.displayName}, ${getAvailabilityLabel(agent.availability)}`}
            accessibilityRole="image"
            accessible
            style={{ height: size, width: size }}
        >
            <EntityAvatar avatarUrl={agent.avatarUrl} name={agent.displayName} size={size} />
            <AvatarStatusBadge availability={agent.availability} avatarSize={size} />
        </View>
    );
}
