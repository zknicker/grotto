import type { HostedAgent } from '@tavern/api';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { AgentFace, type AgentFaceProps } from '../chats/agent-face.tsx';

export function HostedAgentFace({
    agent,
    ...props
}: Omit<AgentFaceProps, 'head'> & {
    agent: Pick<HostedAgent, 'character'>;
}) {
    return <AgentFace {...props} head={agent.character} />;
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
 * Face with its presence dot pinned to the visual corner. The face art
 * intentionally overflows its layout box (ears, plumes), so the dot is
 * outset past the corner and ringed with the app background to separate
 * it from the art instead of sitting on top of it.
 */
export function HostedAgentStatusFace({
    agent,
    size = 20,
}: {
    agent: Pick<HostedAgent, 'availability' | 'character'>;
    size?: number;
}) {
    return (
        <span
            className="relative flex shrink-0 items-center justify-center overflow-visible"
            style={{ height: size, width: size }}
        >
            <HostedAgentFace
                agent={agent}
                animate={false}
                size={size}
                style={{ flexShrink: 0, height: size, overflow: 'visible', width: size }}
            />
            <StatusDot
                className="absolute -right-0.5 -bottom-0.5 ring-2 ring-background"
                size="md"
                status={hostedAvailabilityStatus(agent.availability)}
                title={agent.availability}
            />
        </span>
    );
}
